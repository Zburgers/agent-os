import { randomUUID } from 'node:crypto';
import { evaluateWalletPolicy, type WalletPolicy } from './agent-wallet.ts';

export class AgentWalletTransactionError extends Error { readonly code: string; constructor(code: string) { super(code); this.code = code; } }
type Database = { query: (sql: string, values?: unknown[]) => Promise<{ rows: any[]; rowCount?: number }> };
type Signer = { sign: (envelope: Record<string, unknown>) => Promise<string> };
type Broadcaster = { broadcast: (signature: string) => Promise<string> };
type Draft = { id: string; idempotencyKey: string; status: 'simulated' | 'reconciliation_required' | 'submitted'; envelope: Record<string, unknown> };

function nonNegative(value: unknown, code: string) {
  if (!Number.isSafeInteger(value) || Number(value) < 0) throw new AgentWalletTransactionError(code);
  return Number(value);
}

export class AgentWalletTransactionService {
  private readonly database: Database; private readonly signer: Signer; private readonly broadcaster: Broadcaster;
  constructor(database: Database, signer: Signer, broadcaster: Broadcaster) { this.database = database; this.signer = signer; this.broadcaster = broadcaster; }

  async createDraft(input: { idempotencyKey: string; chainId: number; recipient: string; valueMinor: number; gasMinor: number }, context: { policy: WalletPolicy & { id?: string }; policyId?: string; walletId?: string; controls: { paused: boolean; killed: boolean }; dailyUsedMinor?: number; totalUsedMinor?: number }) {
    if (!input.idempotencyKey?.trim()) throw new AgentWalletTransactionError('idempotency_key_required');
    if (!Number.isSafeInteger(input.chainId) || input.chainId <= 0 || typeof input.recipient !== 'string' || !input.recipient.trim()) throw new AgentWalletTransactionError('invalid_transaction_envelope');
    const valueMinor = nonNegative(input.valueMinor, 'invalid_value_minor'); const gasMinor = nonNegative(input.gasMinor, 'invalid_gas_minor');
    const prior = await this.database.query('SELECT id,status,envelope FROM agent_wallet_transaction_drafts WHERE idempotency_key=$1', [input.idempotencyKey]);
    if (prior.rows[0]) return { id: prior.rows[0].id, idempotencyKey: input.idempotencyKey, status: prior.rows[0].status, envelope: prior.rows[0].envelope } as Draft;
    if (context.controls.killed) throw new AgentWalletTransactionError('system_killed');
    if (context.controls.paused) throw new AgentWalletTransactionError('system_paused');
    const usage = context.dailyUsedMinor === undefined || context.totalUsedMinor === undefined
      ? (await this.database.query(`SELECT COALESCE(SUM(value_minor),0)::bigint AS total_used, COALESCE(SUM(value_minor) FILTER (WHERE created_at>=date_trunc('day',now())),0)::bigint AS daily_used FROM agent_wallet_transaction_drafts WHERE status IN ('simulated','submitted')`)).rows[0] ?? { daily_used: 0, total_used: 0 }
      : { daily_used: context.dailyUsedMinor, total_used: context.totalUsedMinor };
    const decision = evaluateWalletPolicy(context.policy, { chainId: input.chainId, recipient: input.recipient, valueMinor, gasMinor, dailyUsedMinor: Number(usage.daily_used), totalUsedMinor: Number(usage.total_used) });
    if (!decision.allowed) throw new AgentWalletTransactionError(decision.code);
    const id = randomUUID(); const envelope = { chainId: input.chainId, recipient: input.recipient, valueMinor, gasMinor };
    const evidence = { outcome: 'success', broadcast: false, policyId: context.policyId ?? context.policy.id ?? null, dailyUsedMinor: Number(usage.daily_used), totalUsedMinor: Number(usage.total_used) };
    const inserted = await this.database.query(`INSERT INTO agent_wallet_transaction_drafts(id,wallet_id,policy_id,idempotency_key,chain_id,recipient,value_minor,gas_minor,status,envelope,simulation_evidence) VALUES($1,COALESCE($2,(SELECT id FROM agent_wallets WHERE status='active')),$3,$4,$5,$6,$7,$8,'simulated',$9,$10) ON CONFLICT(idempotency_key) DO UPDATE SET idempotency_key=EXCLUDED.idempotency_key RETURNING id,status,envelope`, [id, context.walletId ?? null, context.policyId ?? context.policy.id ?? null, input.idempotencyKey, input.chainId, input.recipient, valueMinor, gasMinor, JSON.stringify(envelope), JSON.stringify(evidence)]);
    const row = inserted.rows[0] ?? { id, status: 'simulated', envelope };
    await this.database.query("INSERT INTO agent_wallet_operations(wallet_id,provider,operation_type,outcome,idempotency_key,policy_id,draft_id,value_minor,gas_minor,simulation_evidence) VALUES((SELECT id FROM agent_wallets WHERE status='active'),'platform','transaction_sign','simulated',$1,$2,$3,$4,$5,$6) ON CONFLICT(idempotency_key) DO NOTHING", [input.idempotencyKey, context.policyId ?? context.policy.id ?? null, row.id, valueMinor, gasMinor, JSON.stringify(evidence)]);
    return { id: row.id, idempotencyKey: input.idempotencyKey, status: row.status, envelope: row.envelope } as Draft;
  }

  async execute(_id: string, _options: { liveTestAuthorized?: boolean } = {}) { throw new AgentWalletTransactionError('live_broadcast_not_authorized'); }
  async reconcile(id: string, result: { providerReference: string; outcome: 'confirmed' | 'reverted' | 'unknown' }) {
    const status = result.outcome === 'confirmed' ? 'submitted' : 'reconciliation_required';
    await this.database.query("UPDATE agent_wallet_transaction_drafts SET status=$1 WHERE id=$2", [status, id]);
    await this.database.query("UPDATE agent_wallet_operations SET external_reference=$1,outcome=$2 WHERE draft_id=$3", [result.providerReference, result.outcome === 'confirmed' ? 'succeeded' : 'failed', id]);
    return { id, status, providerReference: result.providerReference };
  }
}
