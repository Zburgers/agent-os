import { randomUUID } from 'node:crypto';
import { evaluateWalletPolicy, type WalletPolicy } from './agent-wallet.ts';

export class AgentWalletTransactionError extends Error { readonly code: string; constructor(code: string) { super(code); this.code = code; } }
type Database = { query: (sql: string, values?: unknown[]) => Promise<{ rows: any[]; rowCount?: number }> };
type Signer = { sign: (envelope: Record<string, unknown>) => Promise<string> };
type Broadcaster = { broadcast: (signature: string) => Promise<string> };
type Draft = { id: string; idempotencyKey: string; status: 'simulated' | 'reconciliation_required' | 'submitted'; envelope: Record<string, unknown> };

export class AgentWalletTransactionService {
  private readonly drafts = new Map<string, Draft>();
  private readonly database: Database;
  private readonly signer: Signer;
  private readonly broadcaster: Broadcaster;
  constructor(database: Database, signer: Signer, broadcaster: Broadcaster) { this.database = database; this.signer = signer; this.broadcaster = broadcaster; }

  async createDraft(input: { idempotencyKey: string; chainId: number; recipient: string; valueMinor: number; gasMinor: number }, context: { policy: WalletPolicy; controls: { paused: boolean; killed: boolean }; dailyUsedMinor: number; totalUsedMinor: number }) {
    if (!input.idempotencyKey?.trim()) throw new AgentWalletTransactionError('idempotency_key_required');
    const existing = this.drafts.get(input.idempotencyKey);
    if (existing) return existing;
    if (context.controls.killed) throw new AgentWalletTransactionError('system_killed');
    if (context.controls.paused) throw new AgentWalletTransactionError('system_paused');
    const decision = evaluateWalletPolicy(context.policy, { chainId: input.chainId, recipient: input.recipient, valueMinor: input.valueMinor, gasMinor: input.gasMinor, dailyUsedMinor: context.dailyUsedMinor, totalUsedMinor: context.totalUsedMinor });
    if (!decision.allowed) throw new AgentWalletTransactionError(decision.code);
    const id = randomUUID();
    const draft: Draft = { id, idempotencyKey: input.idempotencyKey, status: 'simulated', envelope: { chainId: input.chainId, recipient: input.recipient, valueMinor: input.valueMinor, gasMinor: input.gasMinor, simulation: { outcome: 'success', broadcast: false } } };
    this.drafts.set(input.idempotencyKey, draft);
    await this.database.query("INSERT INTO agent_wallet_operations(wallet_id,provider,operation_type,outcome,idempotency_key) VALUES((SELECT id FROM agent_wallets WHERE status='active'),'platform','transaction_sign','succeeded',$1) ON CONFLICT(idempotency_key) DO NOTHING", [input.idempotencyKey]);
    return draft;
  }

  async execute(id: string, options: { liveTestAuthorized?: boolean } = {}) {
    const draft = [...this.drafts.values()].find((value) => value.id === id);
    if (!draft) throw new AgentWalletTransactionError('transaction_not_found');
    if (!options.liveTestAuthorized) throw new AgentWalletTransactionError('live_broadcast_not_authorized');
    const signature = await this.signer.sign(draft.envelope);
    try { const hash = await this.broadcaster.broadcast(signature); draft.status = 'submitted'; await this.database.query("UPDATE agent_wallet_operations SET external_reference=$1 WHERE idempotency_key=$2", [hash, draft.idempotencyKey]); return { ...draft, hash }; } catch { draft.status = 'reconciliation_required'; await this.database.query("UPDATE agent_wallet_operations SET outcome='failed',error_code='reconciliation_required' WHERE idempotency_key=$1", [draft.idempotencyKey]); return draft; }
  }

  async reconcile(id: string, result: { providerReference: string; outcome: 'confirmed' | 'reverted' | 'unknown' }) {
    const draft = [...this.drafts.values()].find((value) => value.id === id) ?? { id, idempotencyKey: id, status: 'reconciliation_required' as const, envelope: {} };
    draft.status = result.outcome === 'confirmed' ? 'submitted' : 'reconciliation_required';
    await this.database.query("UPDATE agent_wallet_operations SET external_reference=$1,outcome=$2 WHERE idempotency_key=$3", [result.providerReference, result.outcome === 'confirmed' ? 'succeeded' : 'failed', draft.idempotencyKey]);
    return draft;
  }
}
