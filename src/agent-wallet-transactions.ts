import { randomUUID } from 'node:crypto';
import { evaluateWalletPolicy, type WalletPolicy } from './agent-wallet.ts';

export class AgentWalletTransactionError extends Error { readonly code: string; constructor(code: string) { super(code); this.code = code; } }
type Query = (sql: string, values?: unknown[]) => Promise<{ rows: any[]; rowCount?: number }>;
type Client = { query: Query; release: () => void };
type Database = { query?: Query; connect?: () => Promise<Client> };
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

  async createDraft(input: { idempotencyKey: string; chainId: number; recipient: string; valueMinor: number; gasMinor: number }, context: { policy: WalletPolicy; policyId: string; walletId: string; lifecycleStatus: 'active'; controls: { paused: boolean; killed: boolean } }) {
    const idempotencyKey = input.idempotencyKey?.trim();
    if (!idempotencyKey) throw new AgentWalletTransactionError('idempotency_key_required');
    const recipient = typeof input.recipient === 'string' ? input.recipient.trim() : '';
    if (!Number.isSafeInteger(input.chainId) || input.chainId <= 0 || !recipient) throw new AgentWalletTransactionError('invalid_transaction_envelope');
    const valueMinor = nonNegative(input.valueMinor, 'invalid_value_minor'); const gasMinor = nonNegative(input.gasMinor, 'invalid_gas_minor');
    if (context.controls.killed) throw new AgentWalletTransactionError('system_killed');
    if (context.controls.paused) throw new AgentWalletTransactionError('system_paused');
    const client = this.database.connect ? await this.database.connect() : { query: this.database.query!, release() {} };
    const envelope = { chainId: input.chainId, recipient, valueMinor, gasMinor };
    try {
      await client.query('BEGIN');
      await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [`wallet-policy:${context.walletId}:${context.policyId}`]);
      await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [`wallet-draft-idempotency:${idempotencyKey}`]);
      const activePolicy = await client.query("SELECT policy_id FROM agent_wallet_policy_current WHERE wallet_id=$1 AND policy_id=$2 AND status='active' FOR SHARE", [context.walletId, context.policyId]);
      if (!activePolicy.rows[0]) throw new AgentWalletTransactionError('policy_not_active');
      const prior = await client.query('SELECT id,status,envelope,wallet_id,policy_id,chain_id,recipient,value_minor,gas_minor FROM agent_wallet_transaction_drafts WHERE idempotency_key=$1 FOR UPDATE', [idempotencyKey]);
      if (prior.rows[0]) {
        const row = prior.rows[0];
        const priorEnvelope = row.envelope ?? {};
        const sameRequest = (row.wallet_id ?? context.walletId) === context.walletId
          && (row.policy_id ?? context.policyId) === context.policyId
          && Number(row.chain_id ?? priorEnvelope.chainId) === input.chainId
          && String(row.recipient ?? priorEnvelope.recipient) === recipient
          && Number(row.value_minor ?? priorEnvelope.valueMinor) === valueMinor
          && Number(row.gas_minor ?? priorEnvelope.gasMinor) === gasMinor;
        if (!sameRequest) throw new AgentWalletTransactionError('idempotency_key_reused_with_different_request');
        await client.query('COMMIT');
        return { id: row.id, idempotencyKey, status: row.status, envelope: row.envelope } as Draft;
      }
      const usage = (await client.query(`SELECT COALESCE(SUM(value_minor + gas_minor),0)::bigint AS total_used, COALESCE(SUM(value_minor + gas_minor) FILTER (WHERE created_at>=date_trunc('day',now())),0)::bigint AS daily_used FROM agent_wallet_transaction_drafts WHERE wallet_id=$1 AND policy_id=$2 AND status IN ('simulated','submitted')`, [context.walletId, context.policyId])).rows[0] ?? { daily_used: 0, total_used: 0 };
      const decision = evaluateWalletPolicy(context.policy, { chainId: input.chainId, recipient, valueMinor, gasMinor, dailyUsedMinor: Number(usage.daily_used), totalUsedMinor: Number(usage.total_used) }, { lifecycleStatus: context.lifecycleStatus });
      if (!decision.allowed) throw new AgentWalletTransactionError(decision.code);
      const id = randomUUID();
      const evidence = { outcome: 'simulated', broadcast: false, policyId: context.policyId, dailyUsedMinor: Number(usage.daily_used), totalUsedMinor: Number(usage.total_used) };
      const inserted = await client.query(`INSERT INTO agent_wallet_transaction_drafts(id,wallet_id,policy_id,idempotency_key,chain_id,recipient,value_minor,gas_minor,status,envelope,simulation_evidence) VALUES($1,$2,$3,$4,$5,$6,$7,$8,'simulated',$9,$10) RETURNING id,status,envelope`, [id, context.walletId, context.policyId, idempotencyKey, input.chainId, recipient, valueMinor, gasMinor, JSON.stringify(envelope), JSON.stringify(evidence)]);
      const row = inserted.rows[0];
      await client.query("INSERT INTO agent_wallet_operations(wallet_id,provider,operation_type,outcome,idempotency_key,policy_id,draft_id,value_minor,gas_minor,simulation_evidence) VALUES($1,'platform','transaction_simulation','simulated',$2,$3,$4,$5,$6,$7)", [context.walletId, idempotencyKey, context.policyId, row.id, valueMinor, gasMinor, JSON.stringify(evidence)]);
      await client.query('COMMIT');
      return { id: row.id, idempotencyKey, status: row.status, envelope: row.envelope } as Draft;
    } catch (error) { try { await client.query('ROLLBACK'); } catch {} throw error; } finally { client.release(); }
  }

  async execute(_id: string, _options: { liveTestAuthorized?: boolean } = {}) { throw new AgentWalletTransactionError('live_broadcast_not_authorized'); }
  async reconcile(id: string, result: { providerReference: string; outcome: 'confirmed' | 'reverted' | 'unknown' }) {
    const status = result.outcome === 'confirmed' ? 'submitted' : 'reconciliation_required';
    await this.database.query("UPDATE agent_wallet_transaction_drafts SET status=$1 WHERE id=$2", [status, id]);
    await this.database.query("UPDATE agent_wallet_operations SET external_reference=$1,outcome=$2 WHERE draft_id=$3", [result.providerReference, result.outcome === 'confirmed' ? 'succeeded' : 'failed', id]);
    return { id, status, providerReference: result.providerReference };
  }
}
