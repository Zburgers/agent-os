#!/usr/bin/env sh
# Runs the browser work-board workflow against a disposable database and app.
set -eu

test_database="goofy_browser_workboard"
test_port="10001"
test_container="goofy-browser-workboard-app"
test_profile="$(mktemp -d)"
test_token="browser-workboard-test-owner"
test_chromium_pid=""

cleanup() {
  [ -z "$test_chromium_pid" ] || kill "$test_chromium_pid" 2>/dev/null || true
  docker rm -f "$test_container" >/dev/null 2>&1 || true
  docker compose exec -T postgres sh -c "psql -U \"\$POSTGRES_USER\" -d postgres -c \"SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '$test_database' AND pid <> pg_backend_pid()\" >/dev/null 2>&1 || true; dropdb --if-exists -U \"\$POSTGRES_USER\" '$test_database'" >/dev/null 2>&1 || true
  rm -rf "$test_profile"
}
trap cleanup EXIT INT TERM

docker compose build app >/dev/null
docker compose exec -T postgres sh -c "dropdb --if-exists -U \"\$POSTGRES_USER\" '$test_database' && createdb -U \"\$POSTGRES_USER\" '$test_database'"
docker compose run --rm --no-deps -e OWNER_DASHBOARD_TOKEN="$test_token" app sh -c "DATABASE_URL=\"\${DATABASE_URL%/*}/$test_database\" npm run migrate" >/dev/null
docker compose run -d --name "$test_container" --no-deps -p "$test_port:3000" -e OWNER_DASHBOARD_TOKEN="$test_token" app sh -c "export DATABASE_URL=\"\${DATABASE_URL%/*}/$test_database\"; exec npm start" >/dev/null

for attempt in $(seq 1 20); do
  curl --silent --fail "http://127.0.0.1:$test_port/healthz" >/dev/null && break
  sleep 1
done
curl --silent --fail "http://127.0.0.1:$test_port/healthz" >/dev/null

/snap/bin/chromium --headless=new --no-sandbox --disable-gpu --remote-debugging-port=9224 --user-data-dir="$test_profile" about:blank >/tmp/goofy-browser-workboard.log 2>&1 &
test_chromium_pid=$!
for attempt in $(seq 1 20); do
  curl --silent http://127.0.0.1:9224/json/version >/dev/null && break
  sleep 1
done

GOOFY_BROWSER_TOKEN="$test_token" GOOFY_BROWSER_PORT="$test_port" GOOFY_CDP_INFO="$(curl --silent -X PUT "http://127.0.0.1:9224/json/new?http://127.0.0.1:$test_port/login")" node --input-type=module - <<'NODE'
const page = JSON.parse(process.env.GOOFY_CDP_INFO);
const ws = new WebSocket(page.webSocketDebuggerUrl);
let sequence = 0;
const waiting = new Map();
const call = (method, params = {}) => new Promise((resolve, reject) => {
  const id = ++sequence;
  waiting.set(id, { resolve, reject });
  ws.send(JSON.stringify({ id, method, params }));
});
await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });
ws.onmessage = event => { const message = JSON.parse(event.data); const handler = waiting.get(message.id); if (handler) { waiting.delete(message.id); message.error ? handler.reject(new Error(message.error.message)) : handler.resolve(message.result); } };
await call('Runtime.enable');
await call('Page.addScriptToEvaluateOnNewDocument', { source: "window.__goofyErrors=[];window.addEventListener('error',event=>window.__goofyErrors.push(String(event.message)));window.addEventListener('unhandledrejection',event=>window.__goofyErrors.push(String(event.reason)))" });
const wait = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));
const until = async (expression, description) => { for (let attempt = 0; attempt < 30; attempt += 1) { if (await value(expression)) return; await wait(250); } throw Error("timed_out:" + description + ":" + await value("JSON.stringify({errors:window.__goofyErrors || [],content:document.querySelector('#pageContent')?.innerText || ''})")); };
const value = async expression => { const evaluated = await call('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }); if (evaluated.exceptionDetails) throw Error(evaluated.exceptionDetails.exception?.description ?? evaluated.exceptionDetails.text); return evaluated.result.value; };
await wait(500);
const token = JSON.stringify(process.env.GOOFY_BROWSER_TOKEN);
await value(`fetch('/api/session',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({token:${token}})}).then(response=>{if(!response.ok)throw Error('login '+response.status);return response.status})`);
const baseUrl = 'http://127.0.0.1:' + process.env.GOOFY_BROWSER_PORT;
await call('Page.navigate', { url: baseUrl + '/' });
const csrfToken = await value(`fetch('/api/session').then(async response => { if (!response.ok) throw Error('session ' + response.status); const session = await response.json(); if (session.session !== 'session' || !session.csrf_token) throw Error('dashboard_not_authenticated:' + document.title); return session.csrf_token; })`);
const pageCsrf = await value("document.querySelector('meta[name=csrf-token]')?.content || ''");
if (pageCsrf !== csrfToken) throw Error("dashboard_csrf_mismatch:" + pageCsrf.length);
for (const route of ['/', '/work', '/activity', '/approvals', '/finance', '/jobs', '/health']) {
  await call('Page.navigate', { url: baseUrl + route });
  const expected = route === '/' ? 'command' : route.slice(1);
  await until(`document.querySelector('main')?.dataset.page === '${expected}' && Boolean(document.querySelector('a[aria-current=page]'))`, 'route_' + expected);
  if (!(await value('document.documentElement.scrollWidth <= document.documentElement.clientWidth'))) throw Error('horizontal_overflow:' + expected);
}
await call('Page.navigate', { url: baseUrl + '/work' });
await until("Boolean(document.querySelector('#filters'))", 'work_loaded');
await value('history.back()');
await until("document.querySelector('main')?.dataset.page === 'health'", 'history_back');
await value('history.forward()');
await until("document.querySelector('main')?.dataset.page === 'work' && Boolean(document.querySelector('#filters'))", 'history_forward');
const ticketId = await value("fetch('/api/tickets',{method:'POST',headers:{'content-type':'application/json','x-csrf-token':" + JSON.stringify(csrfToken) + "},body:JSON.stringify({title:'Browser work-board fixture',status:'ready',priority:4,acceptanceCriteria:'Browser persistence verification'})}).then(async response=>{if(!response.ok)throw Error('ticket '+response.status);return response.json()}).then(ticket=>ticket.id)");
await value(`document.querySelector('#filters').dispatchEvent(new Event('submit',{cancelable:true}))`);
await until(`Boolean(document.querySelector('[data-detail="tickets"][data-id="${ticketId}"]'))`, "ticket_listed");
await value(`document.querySelector('[data-detail="tickets"][data-id="${ticketId}"]').click()`);
await until(`Boolean(document.querySelector('#ticketEdit'))`, "ticket_detail");
await value(`document.querySelector('#ticketEdit [name="title"]').value='Browser work-board edited';document.querySelector('#ticketEdit [name="priority"]').value='8';document.querySelector('#ticketEdit button').click()`);
await until(`fetch('/api/tickets/${ticketId}').then(response => response.json()).then(ticket => ticket.title === 'Browser work-board edited')`, "ticket_edited");
await value(`document.querySelector('#ticketComment [name="body"]').value='Browser comment persisted';document.querySelector('#ticketComment button').click()`);
await until(`fetch('/api/tickets/${ticketId}').then(response => response.json()).then(ticket => ticket.comments.some(comment => comment.body === 'Browser comment persisted'))`, "ticket_comment_persisted");
await value(`document.querySelector('#detailDialog').close();document.querySelector('[data-detail="tickets"][data-id="${ticketId}"]').click()`);
await until(`document.querySelector('#detailBody').innerText.includes('Browser comment persisted')`, "ticket_comment_rendered");
await value(`window.confirm=()=>true;document.querySelector('#ticketTransition [name="status"]').value='validation';document.querySelector('#ticketTransition button').click()`);
await until(`document.querySelector('#ticketTransition [name="status"]').value === 'validation' && document.querySelector('#detailBody').innerText.includes('Ticket Transitioned')`, "ticket_transitioned");
const result = JSON.parse(await value(`JSON.stringify({title:document.querySelector('#ticketEdit [name="title"]').value,status:document.querySelector('#ticketTransition [name="status"]').value,comment:document.querySelector('#detailBody').innerText.includes('Browser comment persisted'),activity:document.querySelector('#detailBody').innerText.includes('Ticket Transitioned')})`));
if (result.title !== 'Browser work-board edited' || result.status !== 'validation' || !result.comment || !result.activity) throw Error(JSON.stringify(result));
const approvalId = await value(`fetch('/api/approvals',{method:'POST',headers:{'content-type':'application/json','x-csrf-token':${JSON.stringify(csrfToken)}},body:JSON.stringify({action_type:'expense',requested_action:'Browser approval fixture',reason:'Verify the routed approval action',risk:'low',recommendation:'Approve the browser fixture only',idempotency_key:'browser-approval-'+Date.now(),expires_at:new Date(Date.now()+86400000).toISOString(),cost_minor:0,maximum_exposure_minor:0,currency:'INR'})}).then(async response=>{if(!response.ok)throw Error('approval '+response.status);return response.json()}).then(record=>record.id)`);
await call('Page.navigate', { url: baseUrl + '/approvals' });
await until(`Boolean(document.querySelector('[data-detail="approvals"][data-id="${approvalId}"]'))`, 'approval_listed');
await value(`document.querySelector('[data-detail="approvals"][data-id="${approvalId}"]').click()`);
await until("Boolean(document.querySelector('[data-approval=approve]'))", 'approval_detail');
await value("window.prompt=()=> 'Browser approval decision';document.querySelector('[data-approval=approve]').click()");
await until(`fetch('/api/approvals/${approvalId}').then(response => response.json()).then(record => record.status === 'approved')`, 'approval_approved');
console.log(JSON.stringify(result));
ws.close();
