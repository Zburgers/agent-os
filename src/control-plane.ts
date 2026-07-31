export type ControlPlanePage = 'command' | 'work' | 'commercial' | 'brief' | 'activity' | 'approvals' | 'finance' | 'jobs' | 'health';

const routes: Record<ControlPlanePage, { href: string; label: string; description: string }> = {
  command: { href: '/', label: 'Command Centre', description: 'A concise operational overview of Goofy Agent OS.' },
  work: { href: '/work', label: 'Work', description: 'Search, inspect, update, comment on, and transition durable work items.' },
  commercial: { href: '/commercial', label: 'Commercial', description: 'Prospects, buyers, offers, outreach outcomes, follow-ups, and the next actions most likely to produce revenue.' },
  brief: { href: '/daily-brief', label: 'Daily Brief', description: 'A print-ready owner deck built from the current operational and commercial record.' },
  activity: { href: '/activity', label: 'Activity', description: 'The complete operational activity stream, with readable event names and technical detail.' },
  approvals: { href: '/approvals', label: 'Approvals', description: 'Owner decisions requiring review, execution boundaries, and auditable decision history.' },
  finance: { href: '/finance', label: 'Finance', description: 'Authoritative PostgreSQL-backed financial position and transaction ledger.' },
  jobs: { href: '/jobs', label: 'Jobs', description: 'Durable job runs, outcomes, failures, and supported owner controls.' },
  health: { href: '/health', label: 'Health', description: 'Runtime health, persisted checks, incidents, and recovery evidence.' },
};

function escapeHtml(value: unknown) {
  return String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]!));
}

function styles() {
  return `:root{color-scheme:dark;--bg:#101514;--panel:#161d1b;--line:#2c3833;--text:#e8eeeb;--muted:#9aa8a1;--accent:#65bd91;--danger:#ffb7b7;--warn:#f0c674}*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--text);font:14px ui-sans-serif,system-ui,sans-serif}button,input,select,textarea{font:inherit}.shell{display:grid;grid-template-columns:228px minmax(0,1fr);min-height:100dvh}.sidebar{position:sticky;top:0;height:100dvh;padding:22px 14px;border-right:1px solid var(--line);background:#121816}.brand{padding:0 10px 23px;font-weight:750}.brand span{display:block;margin-top:5px;color:var(--muted);font-size:11px;letter-spacing:.08em;text-transform:uppercase}.nav{display:grid;gap:3px}.nav a{padding:9px 10px;border-radius:7px;color:var(--muted);text-decoration:none}.nav a:hover,.nav a[aria-current=page]{background:#1b2421;color:var(--text)}.side-note{margin:24px 10px;color:var(--muted);font-size:12px;line-height:1.45}.main{width:min(1480px,100%);margin:auto;padding:30px 34px 50px}.topbar{display:flex;justify-content:space-between;gap:16px;margin-bottom:26px}.eyebrow{color:var(--accent);font-size:11px;font-weight:750;letter-spacing:.1em;text-transform:uppercase}h1{margin:5px 0 0;font-size:28px;letter-spacing:-.04em}.page-description,.record-meta,.row span{color:var(--muted)}.page-description{margin:8px 0 0;max-width:68ch}.actions,.filters{display:flex;flex-wrap:wrap;gap:8px}.button{min-height:38px;padding:9px 12px;border:1px solid var(--line);border-radius:7px;background:transparent;color:var(--text);cursor:pointer}.button.primary{border-color:var(--accent);background:var(--accent);color:#0c2117;font-weight:750}.button.danger{border-color:#8e4a4a;color:var(--danger)}.button:disabled{opacity:.5;cursor:not-allowed}.button:focus-visible,input:focus-visible,textarea:focus-visible,select:focus-visible,a:focus-visible{outline:2px solid var(--accent);outline-offset:2px}.banner{display:none;margin:0 0 18px;padding:10px 12px;border:1px solid var(--line);border-radius:7px}.error{color:var(--danger)}.section{min-width:0;margin-top:18px;padding:18px;border:1px solid var(--line);border-radius:10px;background:var(--panel)}.section:first-child{margin-top:0}.section h2{margin:0;font-size:14px}.section>p{margin:4px 0 16px;color:var(--muted);font-size:12px}.summary-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}.summary{display:block;min-width:0;padding:15px;border:1px solid var(--line);border-radius:9px;background:var(--panel);color:var(--text);text-decoration:none}.summary:hover{border-color:#40524a}.summary label{display:block;color:var(--muted);font-size:12px}.summary strong{display:block;overflow:hidden;margin:12px 0 4px;font-size:20px;text-overflow:ellipsis;white-space:nowrap}.summary small{color:var(--accent)}.grid{display:grid;grid-template-columns:minmax(0,1.3fr) minmax(280px,.9fr);gap:18px}.funnel{display:grid;grid-template-columns:repeat(7,minmax(110px,1fr));gap:1px;overflow:auto;border:1px solid var(--line);border-radius:9px;background:var(--line)}.funnel-item{min-width:110px;padding:14px;background:var(--panel)}.funnel-item span{display:block;color:var(--muted);font-size:11px}.funnel-item strong{display:block;margin-top:8px;font-size:22px}.row{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:12px;padding:12px 0;border-top:1px solid var(--line)}.row:first-child{padding-top:0;border-top:0}.row strong{display:block;overflow-wrap:anywhere}.row span{display:block;margin-top:4px;font-size:12px}.tag{align-self:start;padding:3px 7px;border:1px solid var(--line);border-radius:999px;color:var(--muted);font-size:11px;white-space:nowrap}.status-running,.status-approved,.status-completed,.status-ok,.status-active,.status-won,.status-delivered,.status-replied{border-color:#3b7258;color:#9bd7b5}.status-blocked,.status-dead_letter,.status-failed,.status-open,.status-rejected,.status-bounced,.status-complained,.status-lost{border-color:#8e4a4a;color:var(--danger)}.status-pending,.status-paused,.status-waiting_for_owner,.status-due,.status-potential{border-color:#806a37;color:var(--warn)}.empty{margin:0;padding:12px 0;color:var(--muted);line-height:1.5}.filters{align-items:end;margin:0 0 14px}.filters label,form label{display:grid;gap:7px;color:var(--muted);font-size:12px}.filters input,.filters select{min-width:160px}input,select,textarea{width:100%;padding:9px 10px;border:1px solid var(--line);border-radius:7px;background:var(--bg);color:var(--text)}textarea{min-height:72px;resize:vertical}.table-wrap{overflow:auto}.table{width:100%;border-collapse:collapse;text-align:left}.table th{padding:0 10px 10px;color:var(--muted);font-size:11px;font-weight:650}.table td{padding:11px 10px;border-top:1px solid var(--line);vertical-align:top}.link{padding:0;border:0;background:none;color:var(--text);font:inherit;font-weight:700;text-align:left;cursor:pointer}.link:hover{text-decoration:underline}.pager{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-top:14px}.technical{margin-top:9px}.technical summary{color:var(--muted);font-size:12px;cursor:pointer}.technical pre{overflow:auto;margin:8px 0 0;padding:10px;border:1px solid var(--line);border-radius:7px;background:var(--bg);white-space:pre-wrap}.health{display:grid;gap:9px}.health div{display:flex;justify-content:space-between;gap:12px;padding:9px 0;border-top:1px solid var(--line)}.health div:first-child{padding-top:0;border-top:0}dialog{width:min(760px,calc(100% - 28px));max-height:calc(100dvh - 28px);overflow:auto;padding:20px;border:1px solid var(--line);border-radius:10px;background:var(--panel);color:var(--text)}dialog::backdrop{background:#0009}.dialog-top,.form-actions{display:flex;justify-content:space-between;gap:10px}.form-actions{justify-content:flex-end;margin-top:14px}.detail-grid{display:grid;grid-template-columns:150px minmax(0,1fr);gap:9px}.detail-grid dt{color:var(--muted)}.detail-grid dd{margin:0;overflow-wrap:anywhere}@media(max-width:900px){.summary-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:780px){.shell{display:block}.sidebar{position:static;height:auto;padding:12px 16px;border-right:0;border-bottom:1px solid var(--line)}.brand{padding:0}.brand span,.side-note{display:none}.nav{display:flex;overflow-x:auto;padding-top:10px}.nav a{flex:0 0 auto}.main{padding:20px 16px 36px}.topbar,.grid{display:grid;grid-template-columns:1fr}.summary-grid{grid-template-columns:1fr}.filters{display:grid;grid-template-columns:1fr}.filters input,.filters select{min-width:0}.table{min-width:660px}.row{grid-template-columns:1fr}.tag{justify-self:start}.detail-grid{grid-template-columns:1fr}}`;
}

export function renderControlPlane(page: ControlPlanePage, data: Record<string, unknown> = {}, csrfToken?: string) {
  const current = routes[page];
  const nav = (Object.keys(routes) as ControlPlanePage[]).map(key => `<a href="${routes[key].href}"${key === page ? ' aria-current="page"' : ''}>${routes[key].label}</a>`).join('');
  const initial = JSON.stringify(data).replace(/</g, '\\u003c');
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="csrf-token" content="${escapeHtml(csrfToken ?? '')}"><title>${current.label} · Goofy Agent OS</title><style>${styles()}</style></head><body><div class="shell"><aside class="sidebar"><div class="brand">Goofy Agent OS<span>Owner control plane</span></div><nav class="nav" aria-label="Primary navigation">${nav}</nav><p class="side-note">Commercial actions remain locked until readiness is verified and the owner approves a tranche.</p></aside><main class="main" data-page="${page}"><header class="topbar"><div><div class="eyebrow">Live operational state</div><h1>${current.label}</h1><p class="page-description">${current.description}</p></div><div class="actions"><button class="button" id="refresh" type="button">Refresh now</button>${page === 'command' ? '<button class="button primary" id="newTask" type="button">New task</button>' : ''}</div></header><div id="banner" class="banner" role="status"></div><div id="pageContent"><p class="empty">Loading authoritative records…</p></div></main></div><dialog id="detailDialog"><div class="dialog-top"><h2 id="detailTitle">Record</h2><button class="button" data-close>Close</button></div><div id="detailBody"></div></dialog><dialog id="taskDialog"><h2>New task</h2><form id="taskForm"><label>Title<input name="title" required maxlength="500"></label><label>Status<select name="status"><option value="backlog">Backlog</option><option value="ready">Ready</option><option value="in_progress">In progress</option><option value="blocked">Blocked</option><option value="waiting_for_owner">Waiting for owner</option></select></label><label>Priority<input name="priority" type="number" value="0"></label><p id="taskError" class="error"></p><div class="form-actions"><button class="button" type="button" data-close>Cancel</button><button class="button primary">Create task</button></div></form></dialog><script>window.__goofyInitial=${initial};</script><script>${clientScript()}</script></body></html>`;
}

function clientScript() {
  return String.raw`
(() => {
  const page = document.querySelector('main').dataset.page;
  const content = document.getElementById('pageContent');
  const csrf = document.querySelector('meta[name="csrf-token"]')?.content || '';
  const state = { offset: 0, limit: 20, total: 0 };
  const $ = id => document.getElementById(id);
  const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[char]));
  const label = value => String(value ?? '').replaceAll('_', ' ').replace(/\b\w/g, char => char.toUpperCase());
  const when = value => value ? new Date(value).toLocaleString() : 'Not recorded';
  const money = value => new Intl.NumberFormat('en-IN', { style:'currency', currency:'INR', maximumFractionDigits:2 }).format(Number(value || 0) / 100);
  const moneyIn = (value, currency = 'INR') => new Intl.NumberFormat('en-IN', { style:'currency', currency, maximumFractionDigits:2 }).format(Number(value || 0) / 100);
  const eventLabel = value => ({ hermes_tool_guard_allowed:'Tool action allowed', hermes_tool_guard_denied:'Tool action denied', effect_authorized:'Effect authorized', jobs_recovered_after_restart:'Jobs recovered after restart' })[value] || label(value);
  const badge = value => '<span class="tag status-' + escape(value) + '">' + escape(label(value)) + '</span>';
  const empty = text => '<p class="empty">' + escape(text) + '</p>';
  const details = value => value ? '<details class="technical"><summary>Technical details</summary><pre>' + escape(typeof value === 'string' ? value : JSON.stringify(value, null, 2)) + '</pre></details>' : '';

  function message(text, isError) {
    const banner = $('banner');
    banner.className = 'banner' + (isError ? ' error' : '');
    banner.textContent = text;
    banner.style.display = 'block';
  }

  async function api(path, options = {}) {
    const headers = { ...(options.headers || {}) };
    if (options.method && options.method !== 'GET') {
      headers['content-type'] = 'application/json';
      headers['x-csrf-token'] = csrf;
    }
    const response = await fetch(path, { cache:'no-store', ...options, headers });
    if (!response.ok) {
      let error = 'Request failed';
      try { error = (await response.json()).error || error; } catch {}
      throw Error(error);
    }
    return response.status === 204 ? null : response.json();
  }

  function currentFilters() {
    const form = $('filters');
    return form ? Object.fromEntries(new FormData(form).entries()) : {};
  }

  function params(extra = {}) {
    const query = new URLSearchParams({ limit:String(state.limit), offset:String(state.offset) });
    for (const [key, value] of Object.entries({ ...currentFilters(), ...extra })) if (value) query.set(key, String(value));
    return query;
  }

  function filterForm(extra) {
    return '<form id="filters" class="filters" role="search"><label>Search<input name="search" maxlength="200" placeholder="Search records"></label>' + extra + '<button class="button" type="submit">Apply</button></form>';
  }

  function pagination(load) {
    const pages = Math.max(1, Math.ceil(state.total / state.limit));
    return '<div class="pager"><button class="button" id="previous" ' + (state.offset === 0 ? 'disabled' : '') + '>Previous</button><span class="tag">Page ' + (Math.floor(state.offset / state.limit) + 1) + ' of ' + pages + '</span><button class="button" id="next" ' + (state.offset + state.limit >= state.total ? 'disabled' : '') + '>Next</button></div>';
  }

  function bindPagination(load) {
    $('previous')?.addEventListener('click', () => { state.offset = Math.max(0, state.offset - state.limit); load(); });
    $('next')?.addEventListener('click', () => { if (state.offset + state.limit < state.total) { state.offset += state.limit; load(); } });
  }

  function bindFilters(load) {
    $('filters')?.addEventListener('submit', event => { event.preventDefault(); state.offset = 0; load(); });
  }

  function table(headers, rows, noRows) {
    if (!rows.length) return empty(noRows);
    return '<div class="table-wrap"><table class="table"><thead><tr>' + headers.map(header => '<th>' + header + '</th>').join('') + '</tr></thead><tbody>' + rows.join('') + '</tbody></table></div>';
  }

  async function openDetail(kind, id) {
    try {
      const record = await api('/api/' + kind + '/' + encodeURIComponent(id));
      $('detailTitle').textContent = kind === 'tickets' ? 'Work item' : label(kind.slice(0, -1));
      $('detailBody').innerHTML = renderDetail(kind, record);
      $('detailDialog').showModal();
      bindDetailActions(kind, record);
    } catch (error) { message(error.message, true); }
  }

  function renderDetail(kind, record) {
    if (kind === 'tickets') {
      return '<dl class="detail-grid"><dt>Status</dt><dd>' + badge(record.status) + '</dd><dt>Priority</dt><dd>' + escape(record.priority) + '</dd><dt>Venture or objective</dt><dd>' + escape(record.venture_name || record.objective_statement || 'Not linked') + '</dd><dt>Blocked reason</dt><dd>' + escape(record.blocker || 'None') + '</dd></dl><p>' + escape(record.description || 'No description') + '</p><form id="ticketEdit"><label>Title<input name="title" value="' + escape(record.title) + '" required></label><label>Priority<input name="priority" type="number" value="' + escape(record.priority) + '"></label><label>Description<textarea name="description">' + escape(record.description || '') + '</textarea></label><div class="form-actions"><button class="button primary">Save edits</button></div></form><form id="ticketTransition"><label>Status<select name="status">' + ['inbox','backlog','ready','in_progress','blocked','waiting_for_owner','validation','completed','abandoned'].map(status => '<option value="' + status + '" ' + (status === record.status ? 'selected' : '') + '>' + label(status) + '</option>').join('') + '</select></label><label>Blocked reason<input name="blocker" value="' + escape(record.blocker || '') + '"></label><div class="form-actions"><button class="button">Change status</button></div></form><form id="ticketComment"><label>Comment<textarea name="body" required></textarea></label><div class="form-actions"><button class="button">Add comment</button></div></form><h3>Comments</h3>' + ((record.comments || []).map(comment => '<div class="row"><div><strong>' + escape(comment.author_type) + '</strong><span>' + escape(comment.body) + '</span></div></div>').join('') || empty('No comments yet.')) + '<h3>Activity</h3>' + ((record.activity || []).map(item => '<div class="row"><div><strong>' + escape(eventLabel(item.event_type)) + '</strong><span>' + escape(item.actor_type) + ' · ' + when(item.occurred_at) + '</span>' + details(item.payload) + '</div></div>').join('') || empty('No activity yet.'));
    }
    if (kind === 'approvals') {
      return '<dl class="detail-grid"><dt>Requested action</dt><dd>' + escape(record.requested_action) + '</dd><dt>Why approval is required</dt><dd>' + escape(record.reason) + '</dd><dt>Risk category</dt><dd>' + badge(record.risk) + '</dd><dt>Financial exposure</dt><dd>' + money(record.maximum_exposure_minor || record.cost_minor) + ' ' + escape(record.currency || 'INR') + '</dd><dt>Related work item</dt><dd>' + escape(record.ticket?.title || 'Not linked') + '</dd><dt>Proposed execution plan</dt><dd>' + escape(record.recommendation || 'Not recorded') + '</dd><dt>Current status</dt><dd>' + badge(record.status) + '</dd></dl><h3>Decision history</h3>' + ((record.events || []).map(event => '<div class="row"><div><strong>' + escape(label(event.action)) + '</strong><span>' + escape(event.note || 'No note') + ' · ' + when(event.created_at) + '</span>' + details(event.payload) + '</div></div>').join('') || empty('No decision history recorded.')) + '<div class="actions">' + approvalButtons(record) + '</div>';
    }
    if (kind === 'commercial/prospects') {
      return '<dl class="detail-grid"><dt>Pipeline stage</dt><dd>' + badge(record.pipeline_stage) + '</dd><dt>Qualification</dt><dd>' + escape(record.qualification) + '</dd><dt>Score</dt><dd>' + escape(record.qualification_score ?? 'Not scored') + '</dd><dt>Offer</dt><dd>' + escape(record.product_name || 'Not linked') + '</dd><dt>Potential value</dt><dd>' + moneyIn(record.estimated_value_minor, record.currency) + '</dd><dt>Contact</dt><dd>' + escape(record.contact_endpoint_masked || record.contact_channel || 'Not recorded') + '</dd><dt>Next action</dt><dd>' + escape(record.next_action || 'Not scheduled') + ' · ' + when(record.next_action_at) + '</dd></dl><h3>Message timeline</h3>' + ((record.messages || []).map(item => '<div class="row"><div><strong>' + escape(item.subject || label(item.channel)) + '</strong><span>' + escape(label(item.direction)) + ' · ' + when(item.occurred_at) + '</span><span>' + escape(item.content_preview || 'No content preview stored') + '</span></div>' + badge(item.latest_status || 'recorded') + '</div>').join('') || empty('No messages recorded.')) + '<h3>Follow-ups and activities</h3>' + ((record.activities || []).map(item => '<div class="row"><div><strong>' + escape(item.title) + '</strong><span>' + escape(label(item.activity_type)) + ' · due ' + when(item.due_at) + (item.recurrence !== 'none' ? ' · repeats ' + label(item.recurrence) : '') + '</span></div>' + badge(item.status) + '</div>').join('') || empty('No follow-ups recorded.'));
    }
    if (kind === 'jobs') {
      return '<dl class="detail-grid"><dt>Run identifier</dt><dd>' + escape(record.id) + '</dd><dt>Status</dt><dd>' + badge(record.status) + '</dd><dt>Attempts</dt><dd>' + escape(record.attempts) + ' / ' + escape(record.max_attempts) + '</dd><dt>Related work</dt><dd>' + escape(record.ticket_title || record.venture_name || 'Not linked') + '</dd><dt>Failure reason</dt><dd>' + escape(record.last_error || 'None') + '</dd></dl><h3>Runs</h3>' + ((record.runs || []).map(run => '<div class="row"><div><strong>' + escape(run.id) + '</strong><span>Started ' + when(run.started_at) + ' · completed ' + when(run.finished_at) + '</span>' + details(run.output || run.error) + '</div>' + badge(run.status || 'recorded') + '</div>').join('') || empty('No runs recorded.')) + '<div class="actions">' + jobButtons(record) + '</div>';
    }
    return '<dl class="detail-grid">' + Object.entries(record).filter(([key, value]) => key !== 'id' && key !== 'payload' && typeof value !== 'object').map(([key, value]) => '<dt>' + escape(label(key)) + '</dt><dd>' + escape(value) + '</dd>').join('') + '</dl>' + details(record.payload);
  }

  function approvalButtons(record) {
    return ['pending', 'modified'].includes(record.status) ? '<button class="button primary" data-approval="approve" data-id="' + escape(record.id) + '">Approve</button><button class="button danger" data-approval="reject" data-id="' + escape(record.id) + '">Reject</button><button class="button" data-approval="comment" data-id="' + escape(record.id) + '">Comment</button>' : '';
  }

  function jobButtons(record) {
    const buttons = [];
    if (['queued', 'running'].includes(record.status)) buttons.push('<button class="button danger" data-job="cancel" data-id="' + escape(record.id) + '">Cancel</button>');
    if (['queued', 'running'].includes(record.status)) buttons.push('<button class="button" data-job="pause" data-id="' + escape(record.id) + '">Pause</button>');
    if (['completed', 'dead_letter', 'cancelled'].includes(record.status)) buttons.push('<button class="button" data-job="rerun" data-id="' + escape(record.id) + '">Rerun</button>');
    return buttons.join('');
  }

  function bindDetailActions(kind, record) {
    $('ticketEdit')?.addEventListener('submit', async event => { event.preventDefault(); const form = new FormData(event.target); await api('/api/tickets/' + record.id, { method:'PATCH', body:JSON.stringify({ title:form.get('title'), priority:Number(form.get('priority')), description:form.get('description') }) }); await openDetail(kind, record.id); loadWork(); });
    $('ticketTransition')?.addEventListener('submit', async event => { event.preventDefault(); const form = new FormData(event.target); const status = form.get('status'); if (!confirm('Change this ticket status to ' + status + '?')) return; await api('/api/tickets/' + record.id, { method:'PATCH', body:JSON.stringify({ status, blocker:form.get('blocker') }) }); await openDetail(kind, record.id); loadWork(); });
    $('ticketComment')?.addEventListener('submit', async event => { event.preventDefault(); const form = new FormData(event.target); await api('/api/tickets/' + record.id + '/comments', { method:'POST', body:JSON.stringify({ body:form.get('body') }) }); await openDetail(kind, record.id); });
    document.querySelectorAll('[data-approval]').forEach(button => button.onclick = () => approvalAction(button.dataset.id, button.dataset.approval).catch(error => message(error.message, true)));
    document.querySelectorAll('[data-job]').forEach(button => button.onclick = () => jobAction(button.dataset.id, button.dataset.job));
  }

  function bindDetails() { document.querySelectorAll('[data-detail]').forEach(button => button.onclick = () => openDetail(button.dataset.detail, button.dataset.id)); }

  async function approvalAction(id, action) {
    const note = prompt(action === 'approve' ? 'Approval note / execution boundary' : 'Decision note');
    if (note === null) return;
    await api('/api/approvals/' + id + '/' + action, { method:'POST', body:JSON.stringify({ note }) });
    $('detailDialog').close();
    page === 'approvals' ? loadApprovals() : loadCommand();
  }

  async function jobAction(id, action) {
    if (!confirm(label(action) + ' this job?')) return;
    await api('/api/jobs/' + id + '/' + action, { method:'POST', body:'{}' });
    $('detailDialog').close();
    loadJobs();
  }

  async function loadWork() {
    try {
      const records = await api('/api/tickets?' + params());
      state.total = records.total;
      content.innerHTML = filterForm('<label>Status<select name="status"><option value="">All statuses</option>' + ['inbox','backlog','ready','in_progress','blocked','waiting_for_owner','validation','completed','abandoned'].map(status => '<option value="' + status + '">' + label(status) + '</option>').join('') + '</select></label>') + table(['Ticket','Status','Priority','Venture or objective','Blocked'], records.items.map(ticket => '<tr><td><button class="link" data-detail="tickets" data-id="' + escape(ticket.id) + '">' + escape(ticket.title) + '</button></td><td>' + badge(ticket.status) + '</td><td>' + escape(ticket.priority) + '</td><td>' + escape(ticket.venture_name || ticket.objective_statement || 'Not linked') + '</td><td>' + escape(ticket.blocker || 'No') + '</td></tr>'), 'No tickets match this filter.') + pagination(loadWork);
      bindFilters(loadWork); bindPagination(loadWork); bindDetails();
    } catch (error) { content.innerHTML = empty(error.message); }
  }

  async function loadCommercial() {
    try {
      const [overview, prospects, customers, products, messages, activities] = await Promise.all([
        api('/api/commercial/overview'),
        api('/api/commercial/prospects?limit=50'),
        api('/api/commercial/customers?limit=50'),
        api('/api/commercial/products?limit=50'),
        api('/api/commercial/messages?limit=50'),
        api('/api/commercial/activities?limit=50'),
      ]);
      const funnel = overview.funnel || [];
      const openProspects = funnel.filter(item => !['won','lost','disqualified'].includes(item.pipeline_stage)).reduce((sum,item) => sum + Number(item.count), 0);
      const qualified = funnel.filter(item => ['qualified','contacted','engaged','proposal','negotiation'].includes(item.pipeline_stage)).reduce((sum,item) => sum + Number(item.count), 0);
      const pipeline = (overview.pipeline_value || []).map(item => moneyIn(item.open_value_minor,item.currency)).join(' · ') || money(0);
      const nextActions = prospects.items.filter(item => item.next_action || item.next_action_at).slice(0,12);
      content.innerHTML =
        '<div class="summary-grid"><a class="summary" href="#prospects"><label>Open prospects</label><strong>' + openProspects + '</strong><small>' + qualified + ' qualified or active</small></a>' +
        '<a class="summary" href="#messages"><label>Outreach</label><strong>' + escape(overview.messages.sent) + ' sent · ' + escape(overview.messages.replied) + ' replies</strong><small>' + Math.round(Number(overview.messages.reply_rate || 0)*100) + '% reply rate</small></a>' +
        '<a class="summary" href="#buyers"><label>Actual buyers</label><strong>' + escape(overview.customers.active) + '</strong><small>Active customer records</small></a>' +
        '<a class="summary" href="#actions"><label>Follow-ups</label><strong>' + escape(overview.activities.overdue) + ' overdue</strong><small>' + escape(overview.activities.due_this_week) + ' due this week · ' + escape(overview.activities.recurring) + ' recurring</small></a>' +
        '<a class="summary" href="#products"><label>Products and offers</label><strong>' + escape(overview.products.active) + ' active</strong><small>' + escape(overview.products.total) + ' total</small></a>' +
        '<a class="summary" href="#prospects"><label>Open pipeline value</label><strong>' + escape(pipeline) + '</strong><small>Unweighted, not realized revenue</small></a></div>' +
        '<section class="section"><h2>Revenue funnel</h2><p>Every count is derived from durable prospect stages. Pipeline value is potential only.</p><div class="funnel">' +
        (funnel.map(item => '<div class="funnel-item"><span>' + escape(label(item.pipeline_stage)) + '</span><strong>' + escape(item.count) + '</strong></div>').join('') || empty('No prospects have been recorded yet.')) +
        '</div></section><div class="grid"><section id="actions" class="section"><h2>Next best actions</h2><p>Overdue and near-term actions are ordered first.</p>' +
        table(['Prospect','Stage','Next action','Due'],nextActions.map(item => '<tr><td><button class="link" data-detail="commercial/prospects" data-id="' + escape(item.id) + '">' + escape(item.display_name || item.organization || 'Unnamed prospect') + '</button><span class="record-meta">' + escape(item.product_name || 'No offer linked') + '</span></td><td>' + badge(item.pipeline_stage) + '</td><td>' + escape(item.next_action || 'Review prospect') + '</td><td>' + when(item.next_action_at) + '</td></tr>'),'No next actions are scheduled.') +
        '</section><section class="section"><h2>Recurring operations</h2><p>Follow-up, delivery, and renewal work that repeats.</p>' +
        ((activities.items.filter(item => item.recurrence !== 'none').slice(0,10).map(item => '<div class="row"><div><strong>' + escape(item.title) + '</strong><span>' + escape(item.contact_name) + ' · ' + label(item.recurrence) + ' · ' + when(item.due_at) + '</span></div>' + badge(item.status) + '</div>').join('')) || empty('No recurring commercial activities.')) +
        '</section></div><section id="prospects" class="section"><h2>Prospects and potential buyers</h2><p>Unqualified records remain visibly separate from qualified sales opportunities.</p>' +
        table(['Prospect','Stage','Qualification','Potential value','Next action'],prospects.items.map(item => '<tr><td><button class="link" data-detail="commercial/prospects" data-id="' + escape(item.id) + '">' + escape(item.display_name || item.organization || 'Unnamed prospect') + '</button><span class="record-meta">' + escape(item.source) + ' · ' + escape(item.contact_endpoint_masked || item.contact_channel || 'No contact endpoint') + '</span></td><td>' + badge(item.pipeline_stage) + '</td><td>' + escape(item.qualification_score ?? '—') + '<span class="record-meta">' + escape(item.qualification) + '</span></td><td>' + moneyIn(item.estimated_value_minor,item.currency) + '</td><td>' + escape(item.next_action || 'Not scheduled') + '<span class="record-meta">' + when(item.next_action_at) + '</span></td></tr>'),'No prospects recorded.') +
        '</section><section id="buyers" class="section"><h2>Actual buyers and customers</h2><p>Customers are separate from prospects; settled revenue is derived from verified payment records.</p>' +
        table(['Customer','Status','Settled revenue','Next action'],customers.items.map(item => '<tr><td><strong>' + escape(item.display_name) + '</strong><span class="record-meta">' + escape(item.source_organization || item.venture_name || 'No source linked') + '</span></td><td>' + badge(item.lifecycle_status) + '</td><td>' + moneyIn(item.settled_revenue_minor,item.currency) + '</td><td>' + escape(item.next_action || 'Not scheduled') + '<span class="record-meta">' + when(item.next_action_at) + '</span></td></tr>'),'No customers have been recorded yet.') +
        '</section><section id="products" class="section"><h2>Products, offers, and pricing</h2><p>Current sellable offers and the prospects attached to each.</p>' +
        table(['Offer','Status','Pricing','Target buyer','Pipeline'],products.items.map(item => '<tr><td><strong>' + escape(item.name) + '</strong><span class="record-meta">' + escape(item.description) + '</span></td><td>' + badge(item.status) + '</td><td>' + escape(label(item.pricing_model)) + '<span class="record-meta">' + (item.price_minor === null ? 'Custom quote' : moneyIn(item.price_minor,item.currency)) + (item.billing_interval ? ' / ' + escape(item.billing_interval) : '') + '</span></td><td>' + escape(item.target_customer) + '</td><td>' + escape(item.active_prospects) + ' active · ' + escape(item.won) + ' won</td></tr>'),'No products or offers recorded.') +
        '</section><section id="messages" class="section"><h2>Outreach and conversations</h2><p>Content is deliberately limited to a short redacted preview; effect and approval IDs prove external-action authority.</p>' +
        table(['Contact / message','Direction','Delivery / reply state','When','Authorization'],messages.items.map(item => '<tr><td><strong>' + escape(item.contact_name) + '</strong><span class="record-meta">' + escape(item.subject || label(item.channel)) + '</span><span class="record-meta">' + escape(item.content_preview || 'No preview stored') + '</span></td><td>' + badge(item.direction) + '</td><td>' + badge(item.latest_status || 'recorded') + '</td><td>' + when(item.occurred_at) + '</td><td>' + escape(item.effect_intent_id ? 'Effect ' + item.effect_intent_id : 'Inbound') + '<span class="record-meta">' + escape(item.approval_id ? 'Approval ' + item.approval_id : '') + '</span></td></tr>'),'No messages recorded.') +
        '</section><section class="section"><h2>Follow-ups and commercial activities</h2><p>One-off and recurring research, proposal, delivery, and renewal actions.</p>' +
        table(['Activity','Contact','Status','Due','Recurrence'],activities.items.map(item => '<tr><td><strong>' + escape(item.title) + '</strong><span class="record-meta">' + escape(label(item.activity_type)) + ' · ' + escape(item.detail || '') + '</span></td><td>' + escape(item.contact_name) + '</td><td>' + badge(item.status) + '</td><td>' + when(item.due_at) + '</td><td>' + escape(label(item.recurrence)) + '</td></tr>'),'No commercial activities recorded.') + '</section>';
      bindDetails();
    } catch (error) { content.innerHTML = empty(error.message); }
  }

  async function loadActivity() {
    try {
      const records = await api('/api/activity?' + params());
      state.total = records.total;
      content.innerHTML = filterForm('<label>Event type<input name="event_type"></label><label>Source<select name="source"><option value="">All sources</option><option value="owner">Owner</option><option value="agent">Agent</option><option value="system">System</option><option value="hermes">Hermes</option></select></label><label>From<input name="date_from" type="date"></label><label>To<input name="date_to" type="date"></label>') + table(['Event','Source','Related entity','When'], records.items.map(item => '<tr><td><strong>' + escape(eventLabel(item.event_type)) + '</strong><span class="record-meta">' + escape(item.event_type) + '</span>' + details(item.payload) + '</td><td>' + escape(label(item.actor_type)) + '</td><td>' + escape(item.entity_type) + '</td><td>' + when(item.occurred_at) + '</td></tr>'), 'No activity events match this filter.') + pagination(loadActivity);
      bindFilters(loadActivity); bindPagination(loadActivity);
    } catch (error) { content.innerHTML = empty(error.message); }
  }

  async function loadApprovals() {
    try {
      const records = await api('/api/approvals?' + params());
      state.total = records.total;
      content.innerHTML = filterForm('<label>Status<select name="status"><option value="">All statuses</option>' + ['pending','modified','approved','rejected','expired','cancelled'].map(status => '<option value="' + status + '">' + label(status) + '</option>').join('') + '</select></label>') + table(['Requested action','Why / risk','Exposure','Related records','Status'], records.items.map(approval => '<tr><td><button class="link" data-detail="approvals" data-id="' + escape(approval.id) + '">' + escape(approval.requested_action) + '</button></td><td>' + escape(approval.reason) + '<span class="record-meta">' + escape(label(approval.risk)) + '</span></td><td>' + money(approval.maximum_exposure_minor || approval.cost_minor) + ' ' + escape(approval.currency || 'INR') + '</td><td>' + escape(approval.venture_name || 'No venture') + '<span class="record-meta">' + escape(approval.ticket_title || 'No work item') + '</span></td><td>' + badge(approval.status) + '<div class="actions">' + approvalButtons(approval) + '</div></td></tr>'), 'No approvals match this filter.') + pagination(loadApprovals);
      bindFilters(loadApprovals); bindPagination(loadApprovals); bindDetails(); document.querySelectorAll('[data-approval]').forEach(button => button.onclick = () => approvalAction(button.dataset.id, button.dataset.approval).catch(error => message(error.message, true)));
    } catch (error) { content.innerHTML = empty(error.message); }
  }

  async function loadFinance() {
    try {
      const [records, overview, wallet, agentWallet] = await Promise.all([api('/api/ledger?' + params()), api('/api/overview'), api('/api/wallet/status'), api('/api/agent-wallet/status')]);
      state.total = records.total; const financial = overview.financial || {}; const walletBalance = wallet.balance_wei === null ? 'Unavailable' : (Number(wallet.balance_wei) / 1e18).toFixed(6) + ' ETH';
      const dedicated = agentWallet.wallet ? '<div class="row"><div><strong>Dedicated Goofy wallet</strong><span>' + escape(agentWallet.wallet.address) + ' · chains ' + escape((agentWallet.wallet.allowed_chain_ids || []).join(', ')) + '</span><span>' + escape(agentWallet.operations.length) + ' recorded signing operations · secret ' + escape(agentWallet.key_exposure) + '</span></div>' + badge(agentWallet.wallet.status) + '</div>' : '<div class="row"><div><strong>Dedicated Goofy wallet</strong><span>Not provisioned</span></div>' + badge('pending') + '</div>';
      const walletSection = '<section id="wallets" class="section"><div class="dialog-top"><div><h2>Wallets and digital assets</h2><p>Blockchain balances remain in native atomic units and are never blended into INR accounting.</p></div><a class="button" href="/wallet">Manage wallet</a></div>' + dedicated + (wallet.link ? '<div class="row"><div><strong>Owner-linked Ethereum Mainnet</strong><span>' + escape(wallet.link.address) + ' · ' + escape(walletBalance) + '</span><span>' + escape(wallet.intents.length) + ' recorded transaction drafts</span></div>' + badge(wallet.configured ? 'active' : 'pending') + '</div>' : empty('No owner wallet has been linked.')) + '</section>';
      content.innerHTML = '<div class="summary-grid"><a class="summary" href="#ledger"><label>Available funds</label><strong>' + money(BigInt(financial.contributions || 0) - BigInt(financial.expenses || 0)) + '</strong></a><a class="summary" href="#ledger"><label>Total contributions</label><strong>' + money(financial.contributions) + '</strong></a><a class="summary" href="#ledger"><label>Total expenditure</label><strong>' + money(financial.expenses) + '</strong></a><a class="summary" href="#ledger"><label>Revenue generated</label><strong>' + money(financial.revenue) + '</strong></a><a class="summary" href="#ledger"><label>Net financial result</label><strong>' + money(financial.realized_net_profit_minor) + '</strong></a></div>' + walletSection + '<section id="ledger" class="section"><h2>Transaction ledger</h2><p>Append-only financial entries from PostgreSQL.</p>' + filterForm('<label>Status<select name="status"><option value="">All statuses</option><option value="settled">Settled</option><option value="pending">Pending</option><option value="expense">Expense</option><option value="revenue">Revenue</option><option value="contribution">Contribution</option></select></label>') + table(['Date','Transaction','Status / category','Amount','Venture / approval'], records.items.map(entry => '<tr><td>' + when(entry.occurred_at) + '</td><td><button class="link" data-detail="ledger" data-id="' + escape(entry.id) + '">' + escape(entry.transaction_id || entry.id) + '</button><span class="record-meta">' + escape(entry.counterparty || 'No counterparty') + '</span></td><td>' + badge(entry.payment_status) + '<span class="record-meta">' + escape(label(entry.entry_type)) + '</span></td><td>' + money(entry.net_minor) + ' ' + escape(entry.currency) + '</td><td>' + escape(entry.venture_name || 'No venture') + '<span class="record-meta">' + escape(entry.approval_action || 'No approval') + '</span></td></tr>'), 'No ledger entries match this filter.') + pagination(loadFinance) + '</section>';
      bindFilters(loadFinance); bindPagination(loadFinance); bindDetails();
    } catch (error) { content.innerHTML = empty(error.message); }
  }

  async function loadJobs() {
    try {
      const records = await api('/api/jobs?' + params());
      state.total = records.total;
      content.innerHTML = filterForm('<label>Status<select name="status"><option value="">All statuses</option>' + ['queued','running','paused','completed','dead_letter','cancelled'].map(status => '<option value="' + status + '">' + label(status) + '</option>').join('') + '</select></label>') + table(['Job','Status','Attempts','Timing','Related work / failure'], records.items.map(job => '<tr><td><button class="link" data-detail="jobs" data-id="' + escape(job.id) + '">' + escape(job.name) + '</button><span class="record-meta">Run ' + escape(job.id) + ' · ' + escape(job.purpose) + '</span></td><td>' + badge(job.status) + '</td><td>' + escape(job.attempts) + ' / ' + escape(job.max_attempts) + '</td><td>Created ' + when(job.created_at) + '<span class="record-meta">Next ' + when(job.next_run_at) + '</span></td><td>' + escape(job.ticket_title || job.venture_name || 'Not linked') + '<span class="record-meta error">' + escape(job.last_error || '') + '</span><div class="actions">' + jobButtons(job) + '</div></td></tr>'), 'No jobs match this filter.') + pagination(loadJobs);
      bindFilters(loadJobs); bindPagination(loadJobs); bindDetails(); document.querySelectorAll('[data-job]').forEach(button => button.onclick = () => jobAction(button.dataset.id, button.dataset.job));
    } catch (error) { content.innerHTML = empty(error.message); }
  }

  async function loadHealth() {
    try {
      const [checks, incidents, overview, telegram] = await Promise.all([api('/api/health-checks?' + params()), api('/api/incidents?limit=20'), api('/api/overview'), api('/api/telegram-delivery-health')]);
      state.total = checks.total; const controls = overview.controls || {}; const jobs = (overview.jobs || []).reduce((total, item) => total + Number(item.count), 0);
      content.innerHTML = '<div class="grid"><section class="section"><h2>Live operational health</h2><p>Current control and runtime state.</p><div class="health"><div><span>Database health</span><strong>Available</strong></div><div><span>Agent runtime</span><strong>' + escape(controls.killed ? 'Killed' : controls.paused ? 'Paused' : 'Running') + '</strong></div><div><span>Scheduler</span><strong>' + jobs + ' tracked jobs</strong></div><div><span>Memory</span><strong>' + escape(overview.memory_provider || 'PostgreSQL scoped fallback') + '</strong></div><div><span>Tool control</span><strong>' + escape(controls.commercial_lock ? 'Commercial lock active' : 'Available') + '</strong></div></div></section><section class="section"><h2>Telegram delivery</h2><p>Payload-free outbox and relay telemetry.</p><div class="health"><div><span>Relay</span><strong>' + escape(telegram.relay.fresh ? 'Fresh' : 'Stale or unavailable') + '</strong></div><div><span>Pending</span><strong>' + escape(telegram.counts.pending) + '</strong></div><div><span>Oldest pending</span><strong>' + escape(telegram.oldest_pending_seconds === null ? 'None' : telegram.oldest_pending_seconds + ' seconds') + '</strong></div><div><span>Reconciliation required</span><strong>' + escape(telegram.counts.reconciliation_required) + '</strong></div><div><span>Failed</span><strong>' + escape(telegram.counts.failed) + '</strong></div></div></section></div><section class="section"><h2>Incidents</h2><p>Open and recent incidents.</p>' + ((incidents.items || []).map(incident => '<div class="row"><div><strong>' + escape(incident.summary) + '</strong><span>' + when(incident.created_at) + '</span>' + details(incident.evidence) + '</div>' + badge(incident.status) + '</div>').join('') || empty('No incidents recorded.')) + '</section><section class="section"><h2>Persisted health checks</h2><p>Historical checks and recovery evidence.</p>' + filterForm('<label>Status<select name="status"><option value="">All statuses</option><option value="ok">OK</option><option value="degraded">Degraded</option><option value="failed">Failed</option></select></label>') + table(['Component','Status','Checked','Detail'], checks.items.map(check => '<tr><td>' + escape(check.component) + '</td><td>' + badge(check.status) + '</td><td>' + when(check.checked_at) + '</td><td>' + escape(check.detail || 'No detail') + details(check.evidence) + '</td></tr>'), 'No persisted health checks match this filter.') + pagination(loadHealth) + '</section>';
      bindFilters(loadHealth); bindPagination(loadHealth);
    } catch (error) { content.innerHTML = empty(error.message); }
  }

  async function loadCommand() {
    try {
      const overview = await api('/api/overview');
      const [tickets, activity, approvals, incidents] = await Promise.all([api('/api/tickets?limit=5&status=in_progress'), api('/api/activity?limit=5'), api('/api/approvals?limit=5&status=pending'), api('/api/incidents?limit=5&status=open')]);
      const financial = overview.financial || {}; const controls = overview.controls || {}; const active = overview.counts?.active_tasks || 0; const jobs = overview.jobs || []; const running = jobs.filter(job => job.status === 'running').reduce((total, job) => total + Number(job.count), 0); const failed = jobs.filter(job => job.status === 'dead_letter').reduce((total, job) => total + Number(job.count), 0);
      content.innerHTML = '<div class="summary-grid"><a class="summary" href="/health"><label>Agent state</label><strong>' + escape(controls.killed ? 'Killed' : controls.paused ? 'Paused' : approvals.total ? 'Awaiting approval' : 'Running') + '</strong><small>View health</small></a><a class="summary" href="/approvals"><label>Owner attention</label><strong>' + approvals.total + ' pending</strong><small>Review approvals</small></a><a class="summary" href="/work"><label>Current work</label><strong>' + active + ' active</strong><small>Open work board</small></a><a class="summary" href="/jobs"><label>Jobs</label><strong>' + running + ' active · ' + failed + ' failed</strong><small>View job history</small></a><a class="summary" href="/health"><label>Active incidents</label><strong>' + incidents.total + '</strong><small>View health</small></a><a class="summary" href="/finance"><label>Available funds</label><strong>' + money(BigInt(financial.contributions || 0) - BigInt(financial.expenses || 0)) + '</strong><small>Open finance</small></a><a class="summary" href="/finance"><label>Revenue / net result</label><strong>' + money(financial.revenue) + ' / ' + money(financial.realized_net_profit_minor) + '</strong><small>Open finance</small></a><a class="summary" href="/health"><label>Health</label><strong>' + escape(controls.killed ? 'Action required' : controls.paused ? 'Paused' : 'Operational') + '</strong><small>View health</small></a></div><div class="grid"><div><section class="section"><h2>Current venture and objective</h2><p>What Goofy is currently doing.</p><div class="row"><div><strong>' + escape(overview.current_venture?.name || 'No active venture') + '</strong><span>' + escape(overview.current_objective?.statement || 'No active objective') + '</span></div></div></section><section class="section"><h2>Active work</h2><p><a href="/work">View complete work board</a></p>' + ((tickets.items || []).map(ticket => '<div class="row"><div><strong>' + escape(ticket.title) + '</strong><span>' + escape(ticket.venture_name || ticket.objective_statement || 'Not linked') + '</span></div>' + badge(ticket.status) + '</div>').join('') || empty('No active work items.')) + '</section></div><div><section class="section"><h2>Owner attention required</h2><p><a href="/approvals">View approval inbox</a></p>' + ((approvals.items || []).map(approval => '<div class="row"><div><strong>' + escape(approval.requested_action) + '</strong><span>' + escape(label(approval.risk)) + ' · ' + money(approval.maximum_exposure_minor || approval.cost_minor) + '</span></div>' + badge(approval.status) + '</div>').join('') || empty('No pending owner approvals.')) + '</section><section class="section"><h2>Health snapshot</h2><p><a href="/health">View complete health record</a></p><div class="health"><div><span>Controls</span><strong>' + escape(controls.killed ? 'Killed' : controls.paused ? 'Paused' : 'Running') + '</strong></div><div><span>Open incidents</span><strong>' + incidents.total + '</strong></div><div><span>Memory</span><strong>' + escape(overview.memory_provider || 'PostgreSQL fallback') + '</strong></div></div></section></div></div><section class="section"><h2>Latest meaningful activity</h2><p><a href="/activity">View complete activity stream</a></p>' + ((activity.items || []).map(item => '<div class="row"><div><strong>' + escape(eventLabel(item.event_type)) + '</strong><span>' + escape(label(item.actor_type)) + ' · ' + when(item.occurred_at) + '</span></div>' + badge(item.entity_type) + '</div>').join('') || empty('No material activity recorded yet.')) + '</section>';
    } catch (error) { content.innerHTML = empty(error.message); }
  }

  function load() {
    $('banner').style.display = 'none';
    ({ command:loadCommand, work:loadWork, commercial:loadCommercial, activity:loadActivity, approvals:loadApprovals, finance:loadFinance, jobs:loadJobs, health:loadHealth }[page])();
  }

  $('refresh').onclick = load;
  $('newTask')?.addEventListener('click', () => $('taskDialog').showModal());
  document.querySelectorAll('[data-close]').forEach(button => button.onclick = () => button.closest('dialog').close());
  $('taskForm').addEventListener('submit', async event => {
    event.preventDefault();
    try {
      const form = new FormData(event.target);
      await api('/api/tickets', { method:'POST', body:JSON.stringify({ title:form.get('title'), status:form.get('status'), priority:Number(form.get('priority')) }) });
      $('taskDialog').close(); loadCommand();
    } catch (error) { $('taskError').textContent = error.message; }
  });
  load();
})();`;
}
