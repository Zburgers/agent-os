import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { timingSafeEqual } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { audit, controls, pool } from './db.ts';
import { basicOwnerToken, bearerToken, createOwnerSession, expiredSessionCookie, getOwnerSession, ownerTokenMatches, parseCookies, revenueTrackMutationAllowed, revokeOwnerSession, runtimeTokensFromEnvironment, sessionCookie } from './auth.ts';
import { redactSecrets } from './redaction.ts';
import { createEntity, isEntityName, listEntity, updateEntity } from './entities.ts';
import { renderControlPlane, type ControlPlanePage } from './control-plane.ts';
import { ApprovalService } from './approvals.ts';
import { reconcileApprovedOperatingTranches } from './finance.ts';
import { ApprovalRequestService } from './approval-requests.ts';
import { TicketService } from './tickets.ts';
import { approvalDetail, jobDetail, ledgerDetail, listActivity, listApprovals, listHealthChecks, listIncidents, listJobs, listLedgerEntries, listTickets, recordChannelRelayHeartbeat, telegramDeliveryHealth, ticketDetail } from './records.ts';
import { TelegramControlService } from './telegram-controls.ts';
import { HybridContextualMemory } from './memory.ts';
import { cancelJob, pauseJob, rerunJob } from './jobs.ts';
import { buildOverviewResponse, type OverviewCounts } from './overview-contract.ts';
import { applySystemControl } from './system-controls.ts';
import { actorContext } from './actor.ts';
import { authorizeEffect, claimAuthorizedEffect, recordExternalResult } from './effects.ts';
import { CommercialOperationsService } from './commercial-operations.ts';
import { buildDailyBriefData, renderDailyBrief, renderCodexOperatingBlockPage } from './daily-brief.ts';
import { WalletService } from './wallet.ts';
import { AgentWalletError, AgentWalletService } from './agent-wallet.ts';
import { renderWalletPage } from './wallet-page.ts';
import { renderRevenuePathsPage } from './revenue-paths-page.ts';
import { PayPalService } from './paypal.ts';
import { publicJavaScriptAsset } from './static-assets.ts';
import { loadApprovalNotificationConfig } from './approval-notifications.ts';
import { ChannelOutboxError, ChannelOutboxService } from './channel-outbox.ts';
import { ReadinessEvidenceError, ReadinessEvidenceService } from './readiness.ts';
import { AgentWalletTransactionError, AgentWalletTransactionService } from './agent-wallet-transactions.ts';
import { RevenueTrackService, RevenueTrackValidationError } from './revenue-tracks.ts';
import { codexOperatingBlockSnapshot, createManualCodexOccurrence, setCodexSchedulePaused } from './codex-operating-block-control.ts';
import { classifyTerminalCommand } from './hermes-effect-policy.ts';

const token = process.env.OWNER_DASHBOARD_TOKEN;
if (!token) throw new Error('OWNER_DASHBOARD_TOKEN must be injected at runtime');
const port = Number(process.env.PORT ?? 3000);
const agentRuntimeTokens = runtimeTokensFromEnvironment();
const approvalNotificationConfig = await loadApprovalNotificationConfig(process.env);
const attempts = new Map<string, { count: number; resetAt: number }>();
const loginAttempts = new Map<string, { count: number; resetAt: number }>();
const approvals = new ApprovalService(pool);
const approvalRequests = new ApprovalRequestService(pool, approvalNotificationConfig);
const tickets = new TicketService(pool);
const commercial = new CommercialOperationsService(pool);
const telegram = new TelegramControlService(
  pool,
  new Set((process.env.OWNER_TELEGRAM_IDS ?? '').split(',').map((id) => id.trim()).filter(Boolean)),
  { approvalSigningSecret: approvalNotificationConfig.signingSecret },
);
const memory = new HybridContextualMemory();
const wallet = new WalletService(pool);
const agentWallet = new AgentWalletService(pool);
const paypal = new PayPalService(pool);
const channelOutbox = new ChannelOutboxService(pool, { ownerTelegramIds: approvalNotificationConfig.ownerTelegramIds });
const readinessEvidence = new ReadinessEvidenceService(pool);
const revenueTracks = new RevenueTrackService(pool);
type Auth = { kind: 'bearer' | 'basic' | 'session' | 'agent'; csrfToken?: string; sessionValue?: string } | null;

function constantEqual(left: string, right: string) { const a = Buffer.from(left); const b = Buffer.from(right); return a.length === b.length && timingSafeEqual(a, b); }
async function authenticate(headers: import('node:http').IncomingHttpHeaders): Promise<Auth> {
  if (agentRuntimeTokens.some((candidate) => ownerTokenMatches(bearerToken(headers.authorization), candidate))) return { kind: 'agent' };
  if (ownerTokenMatches(bearerToken(headers.authorization), token)) return { kind: 'bearer' };
  if (ownerTokenMatches(basicOwnerToken(headers.authorization), token)) return { kind: 'basic' };
  const sessionValue = parseCookies(headers.cookie).goofy_session;
  const session = await getOwnerSession(sessionValue);
  return session ? { kind: 'session', csrfToken: session.csrf_token, sessionValue } : null;
}
function mutationAllowed(auth: Auth, req: import('node:http').IncomingMessage) {
  if (!auth) return false;
  if (auth.kind === 'bearer' || auth.kind === 'agent') return true;
  return auth.kind === 'session' && constantEqual(req.headers['x-csrf-token'] ?? '', auth.csrfToken ?? '');
}
function actorFor(auth: Exclude<Auth, null>) { return auth.kind === "agent" ? { type: "agent" as const, id: "goofy-runtime" } : { type: "owner" as const, id: "owner" }; }
function ownerAuth(auth: Auth) { return auth !== null && auth.kind !== 'agent'; }
const guardedToolKinds = new Map<string, string>([
  ['send_message','message'],['telegram_send','message'],['discord_send','message'],['email_send','message'],
  ['deploy','deployment'],['purchase','purchase'],['payment','payment'],['browser_submit','account_change'],
]);
function inferredEffectKind(toolName: string, args: Record<string, unknown>) {
  const exact = guardedToolKinds.get(toolName);
  if (exact) return exact;
  const lowered = toolName.toLowerCase();
  if (/(message|telegram|discord|email).*(send|post)|^(send|post).*(message|email)/.test(lowered)) return 'message';
  if (/deploy|publish/.test(lowered)) return 'deployment';
  if (/purchase|buy|checkout/.test(lowered)) return 'purchase';
  if (/payment|refund|invoice/.test(lowered)) return 'payment';
  if (/browser/.test(lowered) && /(submit|click|type|upload|login)/.test(lowered)) return 'account_change';
  if (/terminal|shell|exec/.test(lowered)) {
    const command = String(args.command ?? args.cmd ?? '');
    return classifyTerminalCommand(command);
  }
  return null;
}
function rateAllowed(ip: string) {
  const now = Date.now(); const entry = attempts.get(ip);
  if (!entry || entry.resetAt <= now) { attempts.set(ip, { count: 1, resetAt: now + 60_000 }); return true; }
  entry.count += 1; return entry.count <= 300;
}
function loginRateAllowed(ip: string) {
  const now = Date.now(); const entry = loginAttempts.get(ip);
  if (!entry || entry.resetAt <= now) { loginAttempts.set(ip, { count: 1, resetAt: now + 60_000 }); return true; }
  entry.count += 1; return entry.count <= 10;
}
function respond(res: import('node:http').ServerResponse, status: number, data: unknown, contentType = 'application/json; charset=utf-8', headers: Record<string, string> = {}) {
  res.writeHead(status, { 'content-type': contentType, 'cache-control': 'no-store', ...headers }); res.end(typeof data === 'string' ? data : JSON.stringify(data));
}
function respondBytes(res: import('node:http').ServerResponse, status: number, data: Uint8Array, contentType: string) {
  res.writeHead(status, { 'content-type': contentType, 'cache-control': 'private, max-age=86400', 'content-length': String(data.byteLength) });
  res.end(data);
}
async function body(req: import('node:http').IncomingMessage) {
  let raw = ''; for await (const chunk of req) { raw += chunk; if (raw.length > 32_768) throw new Error('body_too_large'); }
  return raw ? JSON.parse(raw) as Record<string, unknown> : {};
}
async function rawBody(req: import('node:http').IncomingMessage) {
  let raw = ''; for await (const chunk of req) { raw += chunk; if (raw.length > 262_144) throw new Error('body_too_large'); }
  return raw;
}
function loginPage() {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Sign in · Goofy Agent OS</title><style>body{font:15px system-ui;margin:0;min-height:100vh;display:grid;place-items:center;background:#101417;color:#e6edf3}main{width:min(420px,calc(100% - 32px));padding:28px;border:1px solid #2e3b45;border-radius:12px;background:#172027}h1{margin:0 0 8px;font-size:22px}p,label{color:#9fb0c0}label{display:block;margin:22px 0 7px}input,button{box-sizing:border-box;width:100%;border-radius:7px;padding:11px;font:inherit}input{background:#101417;border:1px solid #40515e;color:#e6edf3}button{margin-top:16px;border:0;background:#55b892;color:#08261b;font-weight:700;cursor:pointer}#error{min-height:20px;color:#ff9c9c;margin:12px 0 0}</style></head><body><main><h1>Goofy Agent OS</h1><p>Enter the owner dashboard token to start a private session.</p><form id="login"><label for="token">Owner dashboard token</label><input id="token" name="token" type="password" autocomplete="current-password" required><button>Sign in</button><p id="error" role="alert"></p></form></main><script>document.getElementById('login').addEventListener('submit',async e=>{e.preventDefault();const token=document.getElementById('token').value;const r=await fetch('/api/session',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({token})});if(r.ok)location.assign('/');else document.getElementById('error').textContent='Sign-in failed. Check the token and try again.'})</script></body></html>`;
}
function dashboard(data: Record<string, unknown>, csrfToken?: string) {
  const escaped = JSON.stringify(data).replace(/</g, '\\u003c'); const csrf = csrfToken ? `<meta name="csrf-token" content="${csrfToken}">` : '';
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Goofy Agent OS</title>${csrf}<style>body{font:14px system-ui;margin:0;background:#101417;color:#e6edf3}main{max-width:1200px;margin:auto;padding:32px}h1{margin:0 0 8px}p{color:#9fb0c0}pre{white-space:pre-wrap;background:#172027;border:1px solid #2e3b45;padding:18px;border-radius:8px;overflow:auto}</style></head><body><main><h1>Goofy Agent OS</h1><p>Live PostgreSQL-derived operational state. No synthetic metrics.</p><pre id="data"></pre></main><script>document.getElementById('data').textContent=JSON.stringify(${escaped},null,2)</script></body></html>`;
}
async function overview() {
  const [control, financial, counts, approvals, jobs, recent, currentTask, currentObjective, currentVenture] = await Promise.all([
    controls(),
    pool.query(`SELECT COALESCE(SUM(net_minor) FILTER (WHERE entry_type='contribution'),0) AS contributions, COALESCE(SUM(net_minor) FILTER (WHERE entry_type='expense' AND payment_status='settled'),0) AS expenses, COALESCE(SUM(net_minor) FILTER (WHERE entry_type='revenue' AND payment_status='settled'),0) AS revenue, COALESCE(SUM(net_minor) FILTER (WHERE entry_type='refund' AND payment_status='settled'),0) AS refunds, COALESCE(SUM(fees_minor) FILTER (WHERE payment_status='settled'),0) AS fees FROM ledger_entries WHERE currency='INR'`),
    pool.query(`SELECT (SELECT count(*) FROM ventures) AS ventures, (SELECT count(*) FROM tasks WHERE status='in_progress') AS active_tasks, (SELECT count(*) FROM experiments) AS experiments, (SELECT count(*) FROM opportunities WHERE decision_status='under_consideration') AS opportunities, (SELECT count(*) FROM leads) AS leads, (SELECT count(*) FROM customers) AS customers, (SELECT count(*) FROM artifacts) AS artifacts, (SELECT count(*) FROM incidents WHERE status='open') AS incidents`),
    pool.query(`SELECT id,requested_action,cost_minor,currency,risk,expires_at FROM approvals WHERE status='pending' AND expires_at > now() ORDER BY created_at DESC LIMIT 20`),
    pool.query(`SELECT status,count(*) FROM jobs GROUP BY status ORDER BY status`),
    pool.query(`SELECT occurred_at,event_type,entity_type,entity_id FROM audit_events ORDER BY id DESC LIMIT 20`),
    pool.query("SELECT * FROM tasks WHERE status IN ('in_progress','ready','blocked','waiting_for_owner','validation') ORDER BY priority DESC, updated_at DESC LIMIT 10"),
    pool.query("SELECT * FROM objectives WHERE status='active' ORDER BY created_at DESC LIMIT 1"),
    pool.query("SELECT * FROM ventures ORDER BY created_at DESC LIMIT 1"),
  ]);
  const f = financial.rows[0]; const profit = BigInt(f.revenue) - BigInt(f.refunds) - BigInt(f.fees) - BigInt(f.expenses);
  return buildOverviewResponse({
    controls: control,
    financial: { ...f, realized_net_profit_minor: profit.toString() },
    counts: counts.rows[0] as OverviewCounts,
    pendingApprovals: approvals.rows,
    jobs: jobs.rows,
    activity: recent.rows,
    tasks: currentTask.rows,
    currentObjective: currentObjective.rows[0] ?? null,
    currentVenture: currentVenture.rows[0] ?? null,
    memoryProvider: process.env.MEM0_API_KEY ? 'Mem0 Cloud + curated Markdown' : 'Curated Markdown (Mem0 unavailable)',
  });
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`); const ip = req.socket.remoteAddress ?? 'unknown';
  try {
    const versioned = url.pathname.startsWith('/api/v1/');
    if (versioned) url.pathname = `/api/${url.pathname.slice('/api/v1/'.length)}`;
    if (url.pathname === '/healthz') { await pool.query('SELECT 1'); return respond(res, 200, { status: 'ok', database: 'ok', memory_provider: await memory.health(), commercial_lock: (await controls() as any).commercial_lock ?? true }); }
    if (!rateAllowed(ip)) return respond(res, 429, { error: 'rate_limited' });
    if (req.method === 'POST' && url.pathname === '/api/telegram/webhook') {
      const configured = process.env.TELEGRAM_WEBHOOK_SECRET;
      if (!configured || !constantEqual(String(req.headers['x-telegram-bot-api-secret-token'] ?? ''), configured)) return respond(res, 401, { error: 'authentication_required' });
      const update = await body(req); const message = update.message as Record<string, any> | undefined;
      if (!message?.from?.id || typeof message.text !== 'string') return respond(res, 202, { accepted: false });
      return respond(res, 200, await telegram.handle(String(message.from.id), message.text));
    }
    if (req.method === 'GET' && url.pathname === '/login') return respond(res, 200, loginPage(), 'text/html; charset=utf-8');
    if (req.method === 'POST' && url.pathname === '/api/session') {
      if (!loginRateAllowed(ip)) return respond(res, 429, { error: 'rate_limited' });
      const input = await body(req);
      if (typeof input.token !== 'string' || !ownerTokenMatches(input.token, token)) {
        await audit('owner_login_rejected', 'session', null, { reason: 'invalid_credential' }, 'anonymous');
        return respond(res, 401, { error: 'authentication_required' });
      }
      const session = await createOwnerSession(ip); await audit('owner_login', 'session', null, { method: 'token' }, 'owner');
      return respond(res, 201, { csrf_token: session.csrfToken, expires_in_seconds: session.maxAge }, undefined, { 'set-cookie': sessionCookie(session.value) });
    }
    if (req.method === 'POST' && url.pathname === '/webhooks/paypal') {
      const raw = await rawBody(req); return respond(res, 200, await paypal.handleWebhook(req.headers, raw));
    }
    const publicAsset = req.method === 'GET' ? publicJavaScriptAsset(url.pathname) : null;
    if (publicAsset) return respondBytes(res, 200, await readFile(new URL(`../public/${publicAsset}`, import.meta.url)), 'text/javascript; charset=utf-8');
    const auth = await authenticate(req.headers);
    if (!auth) { if (req.method === 'GET' && ['/', '/work', '/commercial', '/activity', '/approvals', '/finance', '/jobs', '/health', '/daily-brief', '/wallet', '/revenue-paths', '/codex-operating-block'].includes(url.pathname)) return respond(res, 302, '', 'text/plain', { location: '/login' }); return respond(res, 401, { error: 'authentication_required' }); }
    if (versioned && req.method !== 'GET' && !String(req.headers['idempotency-key'] ?? '').trim()) return respond(res, 400, { error: 'idempotency_key_required' });
    if (req.method === 'POST' && url.pathname === '/api/logout') {
      if (!mutationAllowed(auth, req)) return respond(res, 403, { error: 'csrf_required' });
      await revokeOwnerSession(auth.sessionValue); await audit('owner_logout', 'session', null, {}, 'owner'); return respond(res, 204, '', undefined, { 'set-cookie': expiredSessionCookie() });
    }
    if (req.method === 'GET' && url.pathname === '/api/session') return respond(res, 200, { session: auth.kind, csrf_token: auth.csrfToken ?? null });
    if (req.method === 'POST' && url.pathname === '/api/channel-outbox/claim') {
      if (auth.kind !== 'agent') return respond(res, 403, { error: 'agent_scope_required' });
      await recordChannelRelayHeartbeat();
      return respond(res, 200, await channelOutbox.claim());
    }
    if (req.method === 'POST' && url.pathname === '/api/readiness/telegram-controls/pass') {
      if (auth.kind !== 'agent') return respond(res, 403, { error: 'agent_scope_required' });
      const input = await body(req);
      return respond(res, 200, await readinessEvidence.passTelegramControls({
        effectId: String(input.effect_id ?? ''), deliveryId: String(input.delivery_id ?? ''), commit: String(input.commit ?? ''),
      }, { type: 'agent', id: 'goofy-runtime' }));
    }
    const channelResult = url.pathname.match(/^\/api\/channel-outbox\/([0-9a-f-]+)\/result$/);
    if (req.method === 'POST' && channelResult) {
      if (auth.kind !== 'agent') return respond(res, 403, { error: 'agent_scope_required' });
      const input = await body(req);
      return respond(res, 200, await channelOutbox.recordResult(channelResult[1], Number(input.attempt), {
        outcome: String(input.outcome ?? '') as 'succeeded' | 'failed' | 'ambiguous',
        receipt: input.receipt && typeof input.receipt === 'object' ? input.receipt as Record<string, unknown> : undefined,
        error: typeof input.error === 'string' ? input.error : undefined,
      }));
    }
    if (req.method === 'POST' && url.pathname === '/api/effects') {
      if (auth.kind !== 'agent') return respond(res, 403, { error: 'agent_scope_required' });
      const input = await body(req);
      const kind = String(input.kind ?? '');
      if (!['message','expense','deployment','payment','account_change','purchase'].includes(kind)) return respond(res, 400, { error: 'invalid_effect_kind' });
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const effect = await authorizeEffect(client, {
          idempotencyKey: String(req.headers['idempotency-key']),
          kind: kind as 'message' | 'expense' | 'deployment' | 'payment' | 'account_change' | 'purchase',
          approvalId: typeof input.approval_id === 'string' ? input.approval_id : undefined,
          payload: input.context && typeof input.context === 'object' ? input.context as Record<string, unknown> : {},
        }, actorContext({ actorType: 'agent', actorId: 'goofy-runtime', credentialScope: `effects:${kind}`, originPlatform: 'api' }));
        await client.query('COMMIT');
        return respond(res, effect.state === 'denied' ? 403 : 201, effect);
      } catch (error) {
        await client.query('ROLLBACK'); throw error;
      } finally {
        client.release();
      }
    }
    const effectResult = url.pathname.match(/^\/api\/effects\/([0-9a-f-]+)\/result$/);
    if (req.method === 'POST' && effectResult) {
      if (auth.kind !== 'agent') return respond(res, 403, { error: 'agent_scope_required' });
      const input = await body(req); const outcome = String(input.outcome ?? '');
      if (!['succeeded','failed','ambiguous'].includes(outcome)) return respond(res, 400, { error: 'invalid_effect_outcome' });
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const state = await recordExternalResult(client, effectResult[1], {
          outcome: outcome as 'succeeded' | 'failed' | 'ambiguous',
          receipt: input.receipt && typeof input.receipt === 'object' ? input.receipt as Record<string, unknown> : undefined,
          error: typeof input.error === 'string' ? redactSecrets(input.error, [token, process.env.DATABASE_URL ?? '']) : undefined,
        });
        await client.query(
          `INSERT INTO audit_events(actor_type,actor_id,event_type,entity_type,entity_id,payload)
           VALUES('agent','goofy-runtime','external_effect_result','effect_intent',$1,$2)`,
          [effectResult[1], JSON.stringify({ state })],
        );
        await client.query('COMMIT');
        return respond(res, 200, { id: effectResult[1], state });
      } catch (error) {
        await client.query('ROLLBACK'); throw error;
      } finally {
        client.release();
      }
    }
    if (req.method === 'POST' && url.pathname === '/api/guard') {
      if (auth.kind !== 'agent') return respond(res, 403, { error: 'agent_scope_required' });
      const input = await body(req); const toolName = String(input.tool_name ?? '').slice(0, 200);
      const args = input.args && typeof input.args === 'object' ? input.args as Record<string, unknown> : {};
      const effectKind = inferredEffectKind(toolName, args);
      const state = await controls();
      let allowed = true; let policyCode: string | null = null;
      if (state.killed) { allowed = false; policyCode = 'system_killed'; }
      else if (state.paused && effectKind) { allowed = false; policyCode = 'system_paused'; }
      else if (effectKind && state.commercial_lock) { allowed = false; policyCode = 'commercial_lock'; }
      else if (effectKind) {
        const effectId = typeof input.effect_id === 'string' ? input.effect_id : '';
        const client = await pool.connect();
        try {
          await client.query('BEGIN');
          if (!await claimAuthorizedEffect(client, effectId, effectKind as any)) {
            allowed = false; policyCode = 'effect_authorization_required_or_consumed';
          }
          await client.query('COMMIT');
        } catch (error) {
          await client.query('ROLLBACK'); throw error;
        } finally {
          client.release();
        }
      }
      await audit(allowed ? 'hermes_tool_guard_allowed' : 'hermes_tool_guard_denied', 'tool_call', null,
        { tool_name: toolName, effect_kind: effectKind, policy_code: policyCode, correlation_id: input.correlation_id ?? null }, 'hermes');
      return respond(res, 200, { allowed, policy_code: policyCode, effect_kind: effectKind });
    }
    if (req.method === 'GET' && url.pathname === '/api/overview') return respond(res, 200, await overview());
    if (req.method === 'GET' && url.pathname === '/wallet') return respond(res, 200, renderWalletPage(auth.csrfToken, process.env.INFURA_PROJECT_ID, await wallet.status(), { ...(await agentWallet.status()), policyVersions: (await pool.query('SELECT id,version,status FROM agent_wallet_platform_policies ORDER BY version DESC LIMIT 20')).rows }), 'text/html; charset=utf-8');
    if (req.method === 'GET' && url.pathname === '/revenue-paths') return respond(res, 200, renderRevenuePathsPage(auth.csrfToken), 'text/html; charset=utf-8');
    if (req.method === 'GET' && url.pathname === '/api/wallet/status') return respond(res, 200, await wallet.status());
    if (req.method === 'GET' && url.pathname === '/api/agent-wallet/status') return respond(res, 200, await agentWallet.status());
    if (req.method === 'POST' && url.pathname === '/api/agent-wallet/provision') {
      if (!mutationAllowed(auth, req) || !ownerAuth(auth)) return respond(res, 403, { error: 'owner_authority_required' });
      return respond(res, 201, await agentWallet.provision(actorFor(auth).id));
    }
    if (req.method === 'POST' && url.pathname === '/api/agent-wallet/sign-message') {
      if (!mutationAllowed(auth, req) || auth.kind !== 'agent') return respond(res, 403, { error: 'agent_scope_required' });
      const input = await body(req);
      return respond(res, 200, await agentWallet.signMessage({
        provider: String(input.provider ?? ''), message: String(input.message ?? ''),
        idempotencyKey: String(input.idempotency_key ?? req.headers['idempotency-key'] ?? ''),
      }));
    }
    if (req.method === 'POST' && url.pathname === '/api/agent-wallet/transactions/broadcast') return respond(res, 403, { error: 'live_test_authorization_required' });
    if (req.method === 'POST' && url.pathname === '/api/agent-wallet/transactions/simulate') {
      if (!mutationAllowed(auth, req) || auth.kind !== 'agent') return respond(res, 403, { error: 'agent_scope_required' });
      const input = await body(req);
      const policyRow = (await pool.query(`SELECT p.id,p.wallet_id,p.policy FROM agent_wallet_policy_current c JOIN agent_wallet_platform_policies p ON p.id=c.policy_id WHERE c.status='active' LIMIT 1`)).rows[0];
      const policy = policyRow?.policy;
      if (!policy) return respond(res, 403, { error: 'policy_not_active' });
      const state = await controls();
      const transactions = new AgentWalletTransactionService(pool, { sign: async () => { throw new AgentWalletTransactionError('signing_not_enabled'); } }, { broadcast: async () => { throw new AgentWalletTransactionError('broadcast_not_enabled'); } });
      return respond(res, 201, await transactions.createDraft({ idempotencyKey: String(input.idempotency_key ?? req.headers['idempotency-key'] ?? ''), chainId: Number(input.chain_id), recipient: String(input.recipient ?? ''), valueMinor: Number(input.value_minor ?? 0), gasMinor: Number(input.gas_minor ?? 0) }, { policy: { ...policy, id: policyRow.id }, policyId: policyRow.id, walletId: policyRow.wallet_id, controls: state }));
    }
    if (req.method === 'POST' && url.pathname === '/api/agent-wallet/policies') {
      if (!mutationAllowed(auth, req) || !ownerAuth(auth)) return respond(res, 403, { error: 'owner_authority_required' });
      return respond(res, 201, await agentWallet.createPlatformPolicy(await body(req), { type: 'owner', id: 'owner' }));
    }
    const policyAction = url.pathname.match(/^\/api\/agent-wallet\/policies\/([0-9a-f-]+)\/(activate|revoke)$/);
    if (req.method === 'POST' && policyAction) {
      if (!mutationAllowed(auth, req) || !ownerAuth(auth)) return respond(res, 403, { error: 'owner_authority_required' });
      const result = policyAction[2] === 'activate' ? await agentWallet.activatePlatformPolicy(policyAction[1], { type: 'owner', id: 'owner' }) : await agentWallet.revokePlatformPolicy(policyAction[1], { type: 'owner', id: 'owner' });
      return respond(res, 200, result);
    }
    if (req.method === 'GET' && url.pathname === '/api/paypal/status') return respond(res, 200, paypal.status());
    if (req.method === 'POST' && url.pathname === '/api/paypal/orders') { if(auth.kind!=='agent') return respond(res,403,{error:'agent_scope_required'}); return respond(res,201,await paypal.createOrder(await body(req))); }
    if (req.method === 'POST' && url.pathname === '/api/wallet/link-nonce') { if (!mutationAllowed(auth,req) || !ownerAuth(auth)) return respond(res,403,{error:'owner_authority_required'}); return respond(res,201,await wallet.nonce()); }
    if (req.method === 'POST' && url.pathname === '/api/wallet/link') { if (!mutationAllowed(auth,req) || !ownerAuth(auth)) return respond(res,403,{error:'owner_authority_required'}); const input=await body(req); if(input.chain_id !== '0x1') return respond(res,400,{error:'ethereum_mainnet_required'}); return respond(res,201,await wallet.link(input)); }
    if (req.method === 'POST' && url.pathname === '/api/wallet/revoke') { if (!mutationAllowed(auth,req) || !ownerAuth(auth)) return respond(res,403,{error:'owner_authority_required'}); return respond(res,200,await wallet.revoke()); }
    if (req.method === 'POST' && url.pathname === '/api/wallet/intents') { if(auth.kind!=='agent') return respond(res,403,{error:'agent_scope_required'}); return respond(res,201,await wallet.create(await body(req))); }
    const walletPrepare=url.pathname.match(/^\/api\/wallet\/intents\/([0-9a-f-]+)\/prepare$/); if(req.method==='POST'&&walletPrepare) { if(!mutationAllowed(auth,req)||!ownerAuth(auth)) return respond(res,403,{error:'owner_authority_required'}); return respond(res,200,await wallet.prepare(walletPrepare[1])); }
    const walletResult=url.pathname.match(/^\/api\/wallet\/intents\/([0-9a-f-]+)\/result$/); if(req.method==='POST'&&walletResult) { if(!mutationAllowed(auth,req)||!ownerAuth(auth)) return respond(res,403,{error:'owner_authority_required'}); return respond(res,200,await wallet.result(walletResult[1],await body(req))); }
    if (req.method === 'GET' && url.pathname === '/daily-brief') {
      return respond(res, 200, renderDailyBrief(await buildDailyBriefData(pool)), 'text/html; charset=utf-8');
    }
    if (req.method === 'GET' && url.pathname === '/codex-operating-block') return respond(res, 200, renderCodexOperatingBlockPage(await codexOperatingBlockSnapshot(pool), auth.csrfToken), 'text/html; charset=utf-8');
    if (req.method === 'GET' && url.pathname === '/api/codex-operating-block') return respond(res, 200, await codexOperatingBlockSnapshot(pool));
    if (req.method === 'POST' && url.pathname === '/api/codex-operating-block/run-now') {
      if (!mutationAllowed(auth, req) || !ownerAuth(auth)) return respond(res, 403, { error: 'owner_authority_required' });
      const result = await createManualCodexOccurrence(pool);
      if (result.status === 'queued') {
        const runner = fileURLToPath(new URL('../scripts/run-codex-operating-block.mjs', import.meta.url));
        const child = spawn(process.execPath, [runner], { cwd: '/home/goofy/agent-os', detached: true, stdio: 'ignore', env: { ...process.env, CODEX_OCCURRENCE_KEY: result.occurrenceKey, CODEX_TRIGGER_KIND: 'manual' } });
        child.unref();
      }
      return respond(res, result.status === 'conflict' ? 409 : 202, result);
    }
    if (req.method === 'POST' && url.pathname === '/api/codex-operating-block/schedule-pause') {
      if (!mutationAllowed(auth, req) || !ownerAuth(auth)) return respond(res, 403, { error: 'owner_authority_required' });
      const input = await body(req);
      return respond(res, 200, await setCodexSchedulePaused(pool, input.paused === true));
    }
    if (req.method === 'GET' && ['/assets/daily-brief-hero.png', '/assets/daily-brief-research.png'].includes(url.pathname)) {
      const filename = url.pathname.endsWith('hero.png') ? 'daily-brief-hero.png' : 'daily-brief-research.png';
      const image = await readFile(new URL(`../assets/${filename}`, import.meta.url));
      return respondBytes(res, 200, image, 'image/png');
    }
    const pageByPath: Record<string, ControlPlanePage> = { '/': 'command', '/work': 'work', '/commercial': 'commercial', '/activity': 'activity', '/approvals': 'approvals', '/finance': 'finance', '/jobs': 'jobs', '/health': 'health' };
    if (req.method === 'GET' && pageByPath[url.pathname]) {
      const page = pageByPath[url.pathname];
      return respond(res, 200, renderControlPlane(page, page === 'command' ? await overview() : {}, auth.csrfToken), 'text/html; charset=utf-8');
    }
    if (req.method === 'POST' && url.pathname === '/api/controls') {
      if (!mutationAllowed(auth, req)) return respond(res, 403, { error: 'csrf_required' });
      if (!ownerAuth(auth)) return respond(res, 403, { error: 'owner_authority_required' });
      const input = await body(req); const action = input.action;
      if (!['pause', 'resume', 'kill'].includes(String(action))) return respond(res, 400, { error: 'invalid_control_action' });
      return respond(res, 200, await applySystemControl(pool, action as 'pause' | 'resume' | 'kill', 'owner', 'owner'));
    }
    if (req.method === 'POST' && url.pathname === '/api/approvals') {
      if (!mutationAllowed(auth, req)) return respond(res, 403, { error: 'csrf_required' });
      const input = await body(req);
      const record = await approvalRequests.request({ actionType: input.action_type as string, requestedAction: input.requested_action as string, reason: input.reason as string, risk: input.risk as string, recommendation: input.recommendation as string, idempotencyKey: input.idempotency_key as string, expiresAt: input.expires_at as string, costMinor: input.cost_minor as number | undefined, maximumExposureMinor: input.maximum_exposure_minor as number | undefined, currency: input.currency as string | undefined, alternatives: input.alternatives as string[] | undefined, evidence: input.evidence as unknown[] | undefined, defaultAction: input.default_action as string | undefined, objectiveId: input.objective_id as string | undefined, ventureId: input.venture_id as string | undefined, experimentId: input.experiment_id as string | undefined, ticketId: input.ticket_id as string | undefined, blocker: input.blocker as string | undefined }, actorFor(auth));
      return respond(res, record.duplicate ? 200 : 201, record);
    }
    const revenueTrackRead = url.pathname.match(/^\/api\/revenue-tracks(?:\/([0-9a-f-]+))?$/);
    const revenueTrackAction = url.pathname.match(/^\/api\/revenue-tracks\/([0-9a-f-]+)\/(reparent|archive)$/);
    if (req.method === 'GET' && revenueTrackRead) {
      if (revenueTrackRead[1]) {
        const record = await revenueTracks.detail(revenueTrackRead[1]);
        return record ? respond(res, 200, record) : respond(res, 404, { error: 'not_found' });
      }
      return respond(res, 200, await revenueTracks.listTree());
    }
    if (((req.method === 'POST' && revenueTrackRead && !revenueTrackRead[1]) || (req.method === 'PATCH' && revenueTrackRead && revenueTrackRead[1]) || (req.method === 'POST' && revenueTrackAction))) {
      const key = typeof req.headers['idempotency-key'] === 'string' ? req.headers['idempotency-key'] : undefined;
      if (!revenueTrackMutationAllowed(auth.kind, key)) return respond(res, auth.kind === 'agent' ? 400 : 403, { error: auth.kind === 'agent' ? 'idempotency_key_required' : 'agent_scope_required' });
      const actor = { type: 'agent' as const, id: 'goofy-runtime' };
      const input = await body(req);
      if (revenueTrackAction) {
        if (revenueTrackAction[2] === 'reparent') return respond(res, 200, await revenueTracks.reparent(revenueTrackAction[1], typeof input.parent_track_id === 'string' ? input.parent_track_id : null, actor, key));
        if (input.status !== 'completed' && input.status !== 'killed') return respond(res, 400, { error: 'invalid_archive_status' });
        return respond(res, 200, await revenueTracks.archive(revenueTrackAction[1], input.status, actor, key));
      }
      if (req.method === 'POST') return respond(res, 201, await revenueTracks.create({ name: String(input.name ?? ''), parentTrackId: typeof input.parent_track_id === 'string' ? input.parent_track_id : null, ownerKind: input.owner_kind as any, status: input.status as any, strategy: input.strategy as string | undefined, targetCustomer: input.target_customer as string | undefined, monetizationModel: input.monetization_model as string | undefined, stage: input.stage as string | undefined, confidence: input.confidence as number | null | undefined, priority: input.priority as number | undefined, expectedValue: input.expected_value as number | string | null | undefined, plannedCostMinor: input.planned_cost_minor as number | undefined, currentAction: input.current_action as string | null | undefined, nextAction: input.next_action as string | null | undefined, reviewDate: input.review_date as string | null | undefined, successCriteria: input.success_criteria as string | null | undefined, killCriteria: input.kill_criteria as string | null | undefined }, actor, key));
      return respond(res, 200, await revenueTracks.update(revenueTrackRead[1]!, { name: input.name as string | undefined, ownerKind: input.owner_kind as any, status: input.status as any, strategy: input.strategy as string | undefined, targetCustomer: input.target_customer as string | undefined, monetizationModel: input.monetization_model as string | undefined, stage: input.stage as string | undefined, confidence: input.confidence as number | null | undefined, priority: input.priority as number | undefined, expectedValue: input.expected_value as number | string | null | undefined, plannedCostMinor: input.planned_cost_minor as number | undefined, currentAction: input.current_action as string | null | undefined, nextAction: input.next_action as string | null | undefined, reviewDate: input.review_date as string | null | undefined, successCriteria: input.success_criteria as string | null | undefined, killCriteria: input.kill_criteria as string | null | undefined }, actor, key));
    }
    if (req.method === "GET" && url.pathname === "/api/tickets") return respond(res, 200, await listTickets({ status: url.searchParams.get("status") ?? undefined, search: url.searchParams.get("search") ?? undefined, limit: Number(url.searchParams.get("limit") ?? 50), offset: Number(url.searchParams.get("offset") ?? 0) }));
    const readPage = () => ({ status: url.searchParams.get("status") ?? undefined, search: url.searchParams.get("search") ?? undefined, eventType: url.searchParams.get("event_type") ?? undefined, source: url.searchParams.get("source") ?? undefined, dateFrom: url.searchParams.get("date_from") ?? undefined, dateTo: url.searchParams.get("date_to") ?? undefined, limit: Number(url.searchParams.get("limit") ?? 50), offset: Number(url.searchParams.get("offset") ?? 0) });
    if (req.method === "GET" && url.pathname === "/api/approvals") return respond(res, 200, await listApprovals(readPage()));
    if (req.method === "GET" && url.pathname === "/api/ledger") return respond(res, 200, await listLedgerEntries(readPage()));
    const ledgerRead = url.pathname.match(/^\/api\/ledger\/([0-9a-f-]+)$/);
    if (req.method === "GET" && ledgerRead) { const record = await ledgerDetail(ledgerRead[1]); return record ? respond(res, 200, record) : respond(res, 404, { error: "not_found" }); }
    if (req.method === "GET" && url.pathname === "/api/jobs") return respond(res, 200, await listJobs(readPage()));
    const jobRead = url.pathname.match(/^\/api\/jobs\/([0-9a-f-]+)$/);
    if (req.method === "GET" && jobRead) { const record = await jobDetail(jobRead[1]); return record ? respond(res, 200, record) : respond(res, 404, { error: "not_found" }); }
    const jobAction = url.pathname.match(/^\/api\/jobs\/([0-9a-f-]+)\/(cancel|pause|rerun)$/);
    if (req.method === 'POST' && jobAction) {
      if (!mutationAllowed(auth, req)) return respond(res, 403, { error: 'csrf_required' });
      if (!ownerAuth(auth)) return respond(res, 403, { error: 'owner_authority_required' });
      if (jobAction[2] === 'cancel') await cancelJob(jobAction[1], 'owner');
      else if (jobAction[2] === 'pause') await pauseJob(jobAction[1], 'owner');
      else await rerunJob(jobAction[1], 'owner');
      return respond(res, 200, await jobDetail(jobAction[1]));
    }
    if (req.method === "GET" && url.pathname === "/api/activity") return respond(res, 200, await listActivity(readPage()));
    if (req.method === "GET" && url.pathname === "/api/health-checks") return respond(res, 200, await listHealthChecks(readPage()));
    if (req.method === 'GET' && url.pathname === '/api/telegram-delivery-health') return respond(res, 200, await telegramDeliveryHealth());
    if (req.method === "GET" && url.pathname === "/api/incidents") return respond(res, 200, await listIncidents(readPage()));
    const commercialPage = () => ({
      status: url.searchParams.get('status') ?? undefined,
      stage: url.searchParams.get('stage') ?? undefined,
      search: url.searchParams.get('search') ?? undefined,
      limit: Number(url.searchParams.get('limit') ?? 50),
      offset: Number(url.searchParams.get('offset') ?? 0),
    });
    if (req.method === 'GET' && url.pathname === '/api/commercial/overview') return respond(res, 200, await commercial.overview());
    if (req.method === 'GET' && url.pathname === '/api/commercial/prospects') return respond(res, 200, await commercial.listProspects(commercialPage()));
    if (req.method === 'GET' && url.pathname === '/api/commercial/products') return respond(res, 200, await commercial.listProducts(commercialPage()));
    if (req.method === 'GET' && url.pathname === '/api/commercial/customers') return respond(res, 200, await commercial.listCustomers(commercialPage()));
    if (req.method === 'GET' && url.pathname === '/api/commercial/messages') return respond(res, 200, await commercial.listMessages(commercialPage()));
    if (req.method === 'GET' && url.pathname === '/api/commercial/activities') return respond(res, 200, await commercial.listActivities(commercialPage()));
    const prospectRead = url.pathname.match(/^\/api\/commercial\/prospects\/([0-9a-f-]+)$/);
    if (req.method === 'GET' && prospectRead) {
      const record = await commercial.prospectDetail(prospectRead[1]);
      return record ? respond(res, 200, record) : respond(res, 404, { error: 'not_found' });
    }
    if (req.method === 'POST' && url.pathname === '/api/commercial/products') {
      if (!mutationAllowed(auth, req)) return respond(res, 403, { error: 'csrf_required' });
      return respond(res, 201, await commercial.createProduct(await body(req), actorFor(auth)));
    }
    if (req.method === 'POST' && url.pathname === '/api/commercial/prospects') {
      if (!mutationAllowed(auth, req)) return respond(res, 403, { error: 'csrf_required' });
      return respond(res, 201, await commercial.createProspect(await body(req), actorFor(auth)));
    }
    if (req.method === 'PATCH' && prospectRead) {
      if (!mutationAllowed(auth, req)) return respond(res, 403, { error: 'csrf_required' });
      return respond(res, 200, await commercial.updateProspect(prospectRead[1], await body(req), actorFor(auth)));
    }
    if (req.method === 'POST' && url.pathname === '/api/commercial/activities') {
      if (!mutationAllowed(auth, req)) return respond(res, 403, { error: 'csrf_required' });
      return respond(res, 201, await commercial.createActivity(await body(req), actorFor(auth)));
    }
    const activityWrite = url.pathname.match(/^\/api\/commercial\/activities\/([0-9a-f-]+)$/);
    if (req.method === 'PATCH' && activityWrite) {
      if (!mutationAllowed(auth, req)) return respond(res, 403, { error: 'csrf_required' });
      return respond(res, 200, await commercial.updateActivity(activityWrite[1], await body(req), actorFor(auth)));
    }
    if (req.method === 'POST' && url.pathname === '/api/commercial/messages') {
      if (!mutationAllowed(auth, req)) return respond(res, 403, { error: 'csrf_required' });
      return respond(res, 201, await commercial.recordMessage(await body(req), actorFor(auth)));
    }
    const messageEvent = url.pathname.match(/^\/api\/commercial\/messages\/([0-9a-f-]+)\/events$/);
    if (req.method === 'POST' && messageEvent) {
      if (!mutationAllowed(auth, req)) return respond(res, 403, { error: 'csrf_required' });
      return respond(res, 201, await commercial.recordMessageEvent(messageEvent[1], await body(req), actorFor(auth)));
    }
    const ticketRead = url.pathname.match(/^\/api\/tickets\/([0-9a-f-]+)$/);
    if (req.method === "GET" && ticketRead) { const record = await ticketDetail(ticketRead[1]); return record ? respond(res, 200, record) : respond(res, 404, { error: "not_found" }); }
    const approvalRead = url.pathname.match(/^\/api\/approvals\/([0-9a-f-]+)$/);
    if (req.method === "GET" && approvalRead) { const record = await approvalDetail(approvalRead[1]); return record ? respond(res, 200, record) : respond(res, 404, { error: "not_found" }); }
    const ticketMatch = url.pathname.match(/^\/api\/tickets(?:\/([0-9a-f-]+)(?:\/(comments|dependencies))?)?$/);
    if (ticketMatch) { const id = ticketMatch[1]; const resource = ticketMatch[2]; if (req.method === "POST" && !id) { if (!mutationAllowed(auth, req)) return respond(res, 403, { error: "csrf_required" }); return respond(res, 201, await tickets.create(await body(req) as any, { type: actorFor(auth).type, id: actorFor(auth).id })); } if (req.method === "PATCH" && id && !resource) { if (!mutationAllowed(auth, req)) return respond(res, 403, { error: "csrf_required" }); const input = await body(req); return respond(res, 200, input.status === undefined ? await tickets.update(id, input as any, { type: actorFor(auth).type, id: actorFor(auth).id }) : await tickets.transition(id, input.status as any, { type: actorFor(auth).type, id: actorFor(auth).id }, input as any)); } if (req.method === "POST" && id && resource === "comments") { if (!mutationAllowed(auth, req)) return respond(res, 403, { error: "csrf_required" }); const input = await body(req); await tickets.comment(id, String(input.body ?? ""), { type: actorFor(auth).type, id: actorFor(auth).id }); return respond(res, 204, ""); } if (req.method === "POST" && id && resource === "dependencies") { if (!mutationAllowed(auth, req)) return respond(res, 403, { error: "csrf_required" }); const input = await body(req); await tickets.addDependency(id, String(input.depends_on_ticket_id ?? ""), { type: actorFor(auth).type, id: actorFor(auth).id }); return respond(res, 204, ""); } }
    const approvalAction = url.pathname.match(/^\/api\/approvals\/([0-9a-f-]+)\/(approve|reject|modify|comment|cancel)$/);
    if (approvalAction && req.method === "POST") {
      if (!mutationAllowed(auth, req)) return respond(res, 403, { error: "csrf_required" });
      if (!ownerAuth(auth)) return respond(res, 403, { error: 'owner_authority_required' });
      const input = await body(req);
      const transitioned = await approvals.transition(approvalAction[1], approvalAction[2] as any, { type: actorFor(auth).type as any, id: actorFor(auth).id }, typeof input.note === "string" ? input.note : undefined, input.replacement as Record<string, unknown> | undefined);
      const releasedTranches = approvalAction[2] === 'approve'
        ? await reconcileApprovedOperatingTranches(pool, { type: 'owner', id: actorFor(auth).id })
        : [];
      return respond(res, 200, { ...transitioned, released_tranches: releasedTranches });
    }
    const entityMatch = url.pathname.match(/^\/api\/(ventures|opportunities|objectives|tasks|experiments|decisions)(?:\/([0-9a-f-]+))?$/);
    if (entityMatch && isEntityName(entityMatch[1])) {
      const entity = entityMatch[1]; const id = entityMatch[2];
      if (req.method === 'GET' && !id) return respond(res, 200, await listEntity(entity));
      if (req.method === 'POST' && !id) { if (!mutationAllowed(auth, req)) return respond(res, 403, { error: 'csrf_required' }); return respond(res, 201, await createEntity(entity, await body(req), actorFor(auth).id)); }
      if (req.method === 'PATCH' && id) { if (!mutationAllowed(auth, req)) return respond(res, 403, { error: 'csrf_required' }); return respond(res, 200, await updateEntity(entity, id, await body(req), actorFor(auth).id)); }
    }
    return respond(res, 404, { error: 'not_found' });
  } catch (error) {
    if (error instanceof AgentWalletError) return respond(res, 400, { error: error.code });
    if (error instanceof RevenueTrackValidationError) return respond(res, 400, { error: error.reason });
    if (error instanceof ChannelOutboxError || error instanceof ReadinessEvidenceError) return respond(res, 409, { error: error.code });
    const message = error instanceof Error ? error.message : 'unknown';
    console.error('request_failed', redactSecrets(message, [token, process.env.DATABASE_URL ?? '']));
    return respond(res, 500, { error: 'internal_error' });
  }
});
server.listen(port, () => console.log(`agent-os listening on ${port}`));
