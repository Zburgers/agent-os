import { createServer } from 'node:http';
import { randomUUID, timingSafeEqual } from 'node:crypto';
import { audit, controls, pool } from './db.ts';
import { basicOwnerToken, bearerToken, createOwnerSession, expiredSessionCookie, getOwnerSession, ownerTokenMatches, parseCookies, revokeOwnerSession, sessionCookie } from './auth.ts';
import { redactSecrets } from './redaction.ts';
import { createEntity, isEntityName, listEntity, updateEntity } from './entities.ts';

const token = process.env.OWNER_DASHBOARD_TOKEN;
if (!token) throw new Error('OWNER_DASHBOARD_TOKEN must be injected at runtime');
const port = Number(process.env.PORT ?? 3000);
const attempts = new Map<string, { count: number; resetAt: number }>();
type Auth = { kind: 'bearer' | 'basic' | 'session'; csrfToken?: string; sessionValue?: string } | null;

function constantEqual(left: string, right: string) { const a = Buffer.from(left); const b = Buffer.from(right); return a.length === b.length && timingSafeEqual(a, b); }
async function authenticate(headers: import('node:http').IncomingHttpHeaders): Promise<Auth> {
  if (ownerTokenMatches(bearerToken(headers.authorization), token)) return { kind: 'bearer' };
  if (ownerTokenMatches(basicOwnerToken(headers.authorization), token)) return { kind: 'basic' };
  const sessionValue = parseCookies(headers.cookie).goofy_session;
  const session = await getOwnerSession(sessionValue);
  return session ? { kind: 'session', csrfToken: session.csrf_token, sessionValue } : null;
}
function mutationAllowed(auth: Auth, req: import('node:http').IncomingMessage) {
  if (!auth) return false;
  if (auth.kind === 'bearer') return true;
  return auth.kind === 'session' && constantEqual(req.headers['x-csrf-token'] ?? '', auth.csrfToken ?? '');
}
function rateAllowed(ip: string) {
  const now = Date.now(); const entry = attempts.get(ip);
  if (!entry || entry.resetAt <= now) { attempts.set(ip, { count: 1, resetAt: now + 60_000 }); return true; }
  entry.count += 1; return entry.count <= 60;
}
function respond(res: import('node:http').ServerResponse, status: number, data: unknown, contentType = 'application/json; charset=utf-8', headers: Record<string, string> = {}) {
  res.writeHead(status, { 'content-type': contentType, 'cache-control': 'no-store', ...headers }); res.end(typeof data === 'string' ? data : JSON.stringify(data));
}
async function body(req: import('node:http').IncomingMessage) {
  let raw = ''; for await (const chunk of req) { raw += chunk; if (raw.length > 32_768) throw new Error('body_too_large'); }
  return raw ? JSON.parse(raw) as Record<string, unknown> : {};
}
function loginPage() {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Sign in · Goofy Agent OS</title><style>body{font:15px system-ui;margin:0;min-height:100vh;display:grid;place-items:center;background:#101417;color:#e6edf3}main{width:min(420px,calc(100% - 32px));padding:28px;border:1px solid #2e3b45;border-radius:12px;background:#172027}h1{margin:0 0 8px;font-size:22px}p,label{color:#9fb0c0}label{display:block;margin:22px 0 7px}input,button{box-sizing:border-box;width:100%;border-radius:7px;padding:11px;font:inherit}input{background:#101417;border:1px solid #40515e;color:#e6edf3}button{margin-top:16px;border:0;background:#55b892;color:#08261b;font-weight:700;cursor:pointer}#error{min-height:20px;color:#ff9c9c;margin:12px 0 0}</style></head><body><main><h1>Goofy Agent OS</h1><p>Enter the owner dashboard token to start a private session.</p><form id="login"><label for="token">Owner dashboard token</label><input id="token" name="token" type="password" autocomplete="current-password" required><button>Sign in</button><p id="error" role="alert"></p></form></main><script>document.getElementById('login').addEventListener('submit',async e=>{e.preventDefault();const token=document.getElementById('token').value;const r=await fetch('/api/session',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({token})});if(r.ok)location.assign('/');else document.getElementById('error').textContent='Sign-in failed. Check the token and try again.'})</script></body></html>`;
}
function dashboard(data: Record<string, unknown>, csrfToken?: string) {
  const escaped = JSON.stringify(data).replace(/</g, '\\u003c'); const csrf = csrfToken ? `<meta name="csrf-token" content="${csrfToken}">` : '';
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Goofy Agent OS</title>${csrf}<style>body{font:14px system-ui;margin:0;background:#101417;color:#e6edf3}main{max-width:1200px;margin:auto;padding:32px}h1{margin:0 0 8px}p{color:#9fb0c0}pre{white-space:pre-wrap;background:#172027;border:1px solid #2e3b45;padding:18px;border-radius:8px;overflow:auto}</style></head><body><main><h1>Goofy Agent OS</h1><p>Live PostgreSQL-derived operational state. No synthetic metrics.</p><pre id="data"></pre></main><script>document.getElementById('data').textContent=JSON.stringify(${escaped},null,2)</script></body></html>`;
}
async function overview() {
  const [control, financial, counts, approvals, jobs, recent] = await Promise.all([
    controls(),
    pool.query(`SELECT COALESCE(SUM(net_minor) FILTER (WHERE entry_type='contribution'),0) AS contributions, COALESCE(SUM(net_minor) FILTER (WHERE entry_type='expense' AND payment_status='settled'),0) AS expenses, COALESCE(SUM(net_minor) FILTER (WHERE entry_type='revenue' AND payment_status='settled'),0) AS revenue, COALESCE(SUM(net_minor) FILTER (WHERE entry_type='refund' AND payment_status='settled'),0) AS refunds, COALESCE(SUM(fees_minor) FILTER (WHERE payment_status='settled'),0) AS fees FROM ledger_entries WHERE currency='INR'`),
    pool.query(`SELECT (SELECT count(*) FROM ventures) AS ventures, (SELECT count(*) FROM tasks WHERE status='in_progress') AS active_tasks, (SELECT count(*) FROM experiments) AS experiments, (SELECT count(*) FROM opportunities WHERE decision_status='under_consideration') AS opportunities, (SELECT count(*) FROM leads) AS leads, (SELECT count(*) FROM customers) AS customers, (SELECT count(*) FROM artifacts) AS artifacts, (SELECT count(*) FROM incidents WHERE status='open') AS incidents`),
    pool.query(`SELECT id,requested_action,cost_minor,currency,risk,expires_at FROM approvals WHERE status='pending' AND expires_at > now() ORDER BY created_at DESC LIMIT 20`),
    pool.query(`SELECT status,count(*) FROM jobs GROUP BY status ORDER BY status`),
    pool.query(`SELECT occurred_at,event_type,entity_type,entity_id FROM audit_events ORDER BY id DESC LIMIT 20`),
  ]);
  const f = financial.rows[0]; const profit = BigInt(f.revenue) - BigInt(f.refunds) - BigInt(f.fees) - BigInt(f.expenses);
  return { controls: control, financial: { ...f, realized_net_profit_minor: profit.toString() }, entities: counts.rows[0], pending_approvals: approvals.rows, jobs: jobs.rows, activity: recent.rows };
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`); const ip = req.socket.remoteAddress ?? 'unknown';
  try {
    if (url.pathname === '/healthz') { await pool.query('SELECT 1'); return respond(res, 200, { status: 'ok', database: 'ok', memory_provider: process.env.MEM0_URL ? 'configured' : 'postgres_scoped_fallback' }); }
    if (!rateAllowed(ip)) return respond(res, 429, { error: 'rate_limited' });
    if (req.method === 'GET' && url.pathname === '/login') return respond(res, 200, loginPage(), 'text/html; charset=utf-8');
    if (req.method === 'POST' && url.pathname === '/api/session') {
      const input = await body(req); if (typeof input.token !== 'string' || !ownerTokenMatches(input.token, token)) return respond(res, 401, { error: 'authentication_required' });
      const session = await createOwnerSession(ip); await audit('owner_login', 'session', null, { method: 'token' }, 'owner');
      return respond(res, 201, { csrf_token: session.csrfToken, expires_in_seconds: session.maxAge }, undefined, { 'set-cookie': sessionCookie(session.value) });
    }
    const auth = await authenticate(req.headers);
    if (!auth) { if (req.method === 'GET' && url.pathname === '/') return respond(res, 302, '', 'text/plain', { location: '/login' }); return respond(res, 401, { error: 'authentication_required' }); }
    if (req.method === 'POST' && url.pathname === '/api/logout') {
      if (!mutationAllowed(auth, req)) return respond(res, 403, { error: 'csrf_required' });
      await revokeOwnerSession(auth.sessionValue); await audit('owner_logout', 'session', null, {}, 'owner'); return respond(res, 204, '', undefined, { 'set-cookie': expiredSessionCookie() });
    }
    if (req.method === 'GET' && url.pathname === '/api/session') return respond(res, 200, { session: auth.kind, csrf_token: auth.csrfToken ?? null });
    if (req.method === 'GET' && (url.pathname === '/' || url.pathname === '/api/overview')) { const data = await overview(); return respond(res, 200, url.pathname === '/' ? dashboard(data, auth.csrfToken) : data, url.pathname === '/' ? 'text/html; charset=utf-8' : undefined); }
    if (req.method === 'POST' && url.pathname === '/api/controls') {
      if (!mutationAllowed(auth, req)) return respond(res, 403, { error: 'csrf_required' });
      const input = await body(req); const action = input.action;
      if (!['pause', 'resume', 'kill'].includes(String(action))) return respond(res, 400, { error: 'invalid_control_action' });
      const changes = action === 'pause' ? [true, 'owner'] : action === 'resume' ? [false, 'owner'] : [true, 'owner']; const column = action === 'kill' ? 'killed' : 'paused';
      await pool.query(`UPDATE system_controls SET ${column}=$1,updated_at=now(),updated_by=$2 WHERE singleton=true`, changes); await audit(`control_${action}`, 'system_controls', null, { correlation_id: randomUUID() }, 'owner'); return respond(res, 200, await controls());
    }
    if (req.method === 'POST' && url.pathname === '/api/approvals') {
      if (!mutationAllowed(auth, req)) return respond(res, 403, { error: 'csrf_required' });
      const input = await body(req); const required = ['action_type','requested_action','reason','risk','recommendation','idempotency_key','expires_at'];
      if (required.some((key) => typeof input[key] !== 'string') || !Number.isSafeInteger(input.cost_minor ?? 0)) return respond(res, 400, { error: 'invalid_approval_request' });
      const expires = new Date(String(input.expires_at)); if (Number.isNaN(expires.valueOf()) || expires <= new Date()) return respond(res, 400, { error: 'invalid_expiry' });
      const { rows } = await pool.query('INSERT INTO approvals(action_type,requested_action,reason,cost_minor,currency,risk,recommendation,idempotency_key,expires_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT(idempotency_key) DO UPDATE SET idempotency_key=EXCLUDED.idempotency_key RETURNING id,status', [input.action_type,input.requested_action,input.reason,input.cost_minor ?? 0,input.currency ?? 'INR',input.risk,input.recommendation,input.idempotency_key,expires]); await audit('approval_requested', 'approval', rows[0].id, { action_type: input.action_type }); return respond(res, 201, rows[0]);
    }
    const entityMatch = url.pathname.match(/^/api/(ventures|opportunities|objectives|tasks|experiments|decisions)(?:/([0-9a-f-]+))? );
    if (entityMatch && isEntityName(entityMatch[1])) {
      const entity = entityMatch[1]; const id = entityMatch[2];
      if (req.method === 'GET' && !id) return respond(res, 200, await listEntity(entity));
      if (req.method === 'POST' && !id) { if (!mutationAllowed(auth, req)) return respond(res, 403, { error: 'csrf_required' }); return respond(res, 201, await createEntity(entity, await body(req))); }
      if (req.method === 'PATCH' && id) { if (!mutationAllowed(auth, req)) return respond(res, 403, { error: 'csrf_required' }); return respond(res, 200, await updateEntity(entity, id, await body(req))); }
    }
    return respond(res, 404, { error: 'not_found' });
  } catch (error) { const message = error instanceof Error ? error.message : 'unknown'; console.error('request_failed', redactSecrets(message, [token, process.env.DATABASE_URL ?? ''])); return respond(res, 500, { error: 'internal_error' }); }
});
server.listen(port, () => console.log(`agent-os listening on ${port}`));
