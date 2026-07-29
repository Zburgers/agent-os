export type ExpenseRequest = {
  amountPaise: number;
  todaySpentPaise: number;
  experimentSpentPaise: number;
  spendablePaise: number;
  reservePaise: number;
  approved: boolean;
  singleLimitPaise?: number;
  dailyLimitPaise?: number;
  experimentLimitPaise?: number;
  /** Actual settled cash in the currency before this expense. */
  cashBalancePaise?: number;
};

export function evaluateExpense(request: ExpenseRequest): { allowed: boolean; reason?: string } {
  if (!request.approved) return { allowed: false, reason: 'owner_approval_required' };
  if (request.spendablePaise <= 0 || request.amountPaise > request.spendablePaise) {
    return { allowed: false, reason: 'no_released_capital' };
  }
  if (request.cashBalancePaise !== undefined && request.amountPaise > request.cashBalancePaise - request.reservePaise) {
    return { allowed: false, reason: 'reserve_preservation_required' };
  }
  if (request.singleLimitPaise !== undefined && request.amountPaise > request.singleLimitPaise) {
    return { allowed: false, reason: 'single_expense_limit_exceeded' };
  }
  if (request.dailyLimitPaise !== undefined && request.todaySpentPaise + request.amountPaise > request.dailyLimitPaise) {
    return { allowed: false, reason: 'daily_spend_limit_exceeded' };
  }
  if (request.experimentLimitPaise !== undefined && request.experimentSpentPaise + request.amountPaise > request.experimentLimitPaise) {
    return { allowed: false, reason: 'experiment_budget_exceeded' };
  }
  return { allowed: true };
}

type LedgerKind = 'contribution' | 'expense' | 'revenue' | 'refund' | 'fee' | 'tax_reserve' | 'adjustment' | 'reversal' | 'reservation';
type LedgerStatus = 'pending' | 'settled' | 'failed' | 'reversed';
export type LedgerEntryInput = { transactionId: string; entryType: LedgerKind; currency: string; grossMinor: number; feesMinor?: number; taxMinor?: number; netMinor: number; counterparty: string; ventureId?: string; experimentId?: string; paymentStatus: LedgerStatus; evidenceUri?: string; providerReference?: string; idempotencyKey: string };
export type ExpenseJustification = { category: string; objective: string; expectedResult: string; evidenceUri: string; alternatives: string[]; worstCaseLoss: string; successCondition: string; stopCondition: string; expectedPayback: string; confidence: number };
export type ExpensePolicy = { singleLimitMinor: number; dailyLimitMinor: number; experimentLimitMinor: number };
type Result<T = Record<string, unknown>> = { rows: T[] };
type Client = { query<T = Record<string, unknown>>(sql: string, values?: unknown[]): Promise<Result<T>>; release(): void };
type Database = { connect(): Promise<Client> };
export class FinancialPolicyError extends Error {
  readonly reason: string;
  constructor(reason: string) { super(reason); this.reason = reason; }
}
const text = (value: unknown): value is string => typeof value === 'string' && value.trim() !== '';

/** Atomic ledger append service. Expense policy is evaluated while the ledger is locked. */
export class LedgerService {
  private readonly database: Database;
  private readonly policy: ExpensePolicy;
  constructor(database: Database, policy: ExpensePolicy) { this.database = database; this.policy = policy; }
  async append(entry: LedgerEntryInput, options: { approvalId?: string; justification?: ExpenseJustification; actorId?: string } = {}) {
    const fees = entry.feesMinor ?? 0; const tax = entry.taxMinor ?? 0;
    if (!text(entry.transactionId) || !text(entry.idempotencyKey) || !text(entry.counterparty) || !/^[A-Z]{3}$/.test(entry.currency) || ![entry.grossMinor, fees, tax, entry.netMinor].every(Number.isSafeInteger) || entry.netMinor !== entry.grossMinor - fees - tax) throw new FinancialPolicyError('invalid_ledger_entry');
    if (entry.entryType === 'expense') this.validateExpense(entry, options);
    const client = await this.database.connect();
    try {
      await client.query('BEGIN');
      const prior = await client.query<{ id: string }>('SELECT id FROM ledger_entries WHERE idempotency_key=$1 FOR SHARE', [entry.idempotencyKey]);
      if (prior.rows[0]) { await client.query('COMMIT'); return { id: prior.rows[0].id, duplicate: true }; }
      const controls = await client.query<{ paused: boolean; killed: boolean; commercial_lock: boolean }>('SELECT paused,killed,commercial_lock FROM system_controls WHERE singleton=true FOR SHARE');
      if (controls.rows[0]?.killed) throw new FinancialPolicyError('system_killed');
      if (controls.rows[0]?.paused) throw new FinancialPolicyError('system_paused');
      if (entry.entryType === 'expense' && controls.rows[0]?.commercial_lock) throw new FinancialPolicyError('commercial_lock');
      if (entry.entryType === 'expense') await this.authorizeExpense(client, entry, options.approvalId!);
      const inserted = await client.query<{ id: string }>(
        `INSERT INTO ledger_entries(transaction_id,entry_type,currency,gross_minor,fees_minor,tax_minor,net_minor,counterparty,
         venture_id,experiment_id,payment_status,evidence_uri,provider_reference,idempotency_key,category,approval_id,
         original_amount_minor,reconciliation_status)
         VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18) RETURNING id`,
        [entry.transactionId,entry.entryType,entry.currency,entry.grossMinor,fees,tax,entry.netMinor,entry.counterparty,
         entry.ventureId ?? null,entry.experimentId ?? null,entry.paymentStatus,entry.evidenceUri ?? null,
         entry.providerReference ?? null,entry.idempotencyKey,options.justification?.category ?? null,options.approvalId ?? null,
         entry.grossMinor,entry.paymentStatus === 'settled' ? 'reconciled' : 'unreconciled'],
      );
      await client.query('INSERT INTO audit_events(actor_type,actor_id,event_type,entity_type,entity_id,payload) VALUES($1,$2,$3,$4,$5,$6)', ['agent', options.actorId ?? 'system', 'ledger_entry_appended', 'ledger_entry', inserted.rows[0].id, JSON.stringify({ transaction_id: entry.transactionId, idempotency_key: entry.idempotencyKey })]);
      await client.query('COMMIT'); return { id: inserted.rows[0].id, duplicate: false };
    } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
  }
  async reverse(originalId: string, entry: LedgerEntryInput, options: { approvalId?: string; actorId?: string } = {}) {
    if (entry.entryType !== 'reversal' || entry.paymentStatus !== 'settled') throw new FinancialPolicyError('invalid_reversal_entry');
    const client = await this.database.connect();
    try {
      await client.query('BEGIN');
      const original = await client.query<{ id: string; currency: string; net_minor: string | number }>(
        'SELECT id,currency,net_minor FROM ledger_entries WHERE id=$1 FOR SHARE',
        [originalId],
      );
      if (!original.rows[0]) throw new FinancialPolicyError('original_entry_not_found');
      if (original.rows[0].currency !== entry.currency || Number(original.rows[0].net_minor) + entry.netMinor !== 0) throw new FinancialPolicyError('reversal_mismatch');
      const duplicate = await client.query<{ id: string }>('SELECT id FROM ledger_entries WHERE idempotency_key=$1', [entry.idempotencyKey]);
      if (duplicate.rows[0]) { await client.query('COMMIT'); return { id: duplicate.rows[0].id, duplicate: true }; }
      const inserted = await client.query<{ id: string }>(
        `INSERT INTO ledger_entries(transaction_id,entry_type,currency,gross_minor,fees_minor,tax_minor,net_minor,counterparty,
         payment_status,evidence_uri,idempotency_key,external_reference,reconciliation_status)
         VALUES($1,'reversal',$2,$3,$4,$5,$6,$7,'settled',$8,$9,$10,'reconciled') RETURNING id`,
        [entry.transactionId,entry.currency,entry.grossMinor,entry.feesMinor ?? 0,entry.taxMinor ?? 0,entry.netMinor,
         entry.counterparty,entry.evidenceUri ?? null,entry.idempotencyKey,`reversal_of:${originalId}`],
      );
      await client.query("INSERT INTO audit_events(actor_type,actor_id,event_type,entity_type,entity_id,payload) VALUES('owner',$1,'ledger_reversal_appended','ledger_entry',$2,$3)",
        [options.actorId ?? 'owner',inserted.rows[0].id,JSON.stringify({ original_id: originalId })]);
      await client.query('COMMIT');
      return { id: inserted.rows[0].id, duplicate: false };
    } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
  }
  private validateExpense(entry: LedgerEntryInput, options: { approvalId?: string; justification?: ExpenseJustification }) {
    const j = options.justification;
    if (!options.approvalId) throw new FinancialPolicyError('owner_approval_required');
    if (entry.paymentStatus !== 'settled' || !Number.isSafeInteger(entry.grossMinor) || entry.grossMinor <= 0 || !entry.ventureId || !entry.experimentId) throw new FinancialPolicyError('invalid_expense_entry');
    if (!j || ![j.category,j.objective,j.expectedResult,j.evidenceUri,j.worstCaseLoss,j.successCondition,j.stopCondition,j.expectedPayback].every(text) || !Array.isArray(j.alternatives) || !j.alternatives.every(text) || !Number.isInteger(j.confidence) || j.confidence < 0 || j.confidence > 100) throw new FinancialPolicyError('expense_justification_required');
  }
  private async authorizeExpense(client: Client, entry: LedgerEntryInput, approvalId: string) {
    const approval = await client.query<{ id: string }>("SELECT id FROM approvals WHERE id=$1 AND status='approved' AND expires_at>now() AND action_type='expense' AND cost_minor=$2 AND currency=$3 FOR SHARE", [approvalId,entry.grossMinor,entry.currency]);
    if (!approval.rows[0]) throw new FinancialPolicyError('owner_approval_required');
    const state = await client.query<{ released: string | number; reserve: string | number }>('SELECT released_operating_minor AS released,required_reserve_minor AS reserve FROM financial_policy_state WHERE currency=$1 FOR UPDATE', [entry.currency]);
    const totals = await client.query<{ today: string | number; experiment: string | number; expenses: string | number; cash: string | number }>("SELECT COALESCE(SUM(gross_minor) FILTER(WHERE entry_type='expense' AND payment_status='settled' AND occurred_at>=date_trunc('day',now())),0) AS today,COALESCE(SUM(gross_minor) FILTER(WHERE entry_type='expense' AND payment_status='settled' AND experiment_id=$2),0) AS experiment,COALESCE(SUM(gross_minor) FILTER(WHERE entry_type='expense' AND payment_status='settled'),0) AS expenses,COALESCE(SUM(net_minor) FILTER(WHERE entry_type IN ('contribution','revenue') AND payment_status='settled'),0)-COALESCE(SUM(gross_minor) FILTER(WHERE entry_type IN ('expense','refund') AND payment_status='settled'),0) AS cash FROM ledger_entries WHERE currency=$1 FOR SHARE", [entry.currency,entry.experimentId]);
    const s = state.rows[0] ?? { released: 0, reserve: 0 }; const t = totals.rows[0] ?? { today: 0, experiment: 0, expenses: 0, cash: 0 };
    const result = evaluateExpense({ amountPaise: entry.grossMinor, todaySpentPaise: Number(t.today), experimentSpentPaise: Number(t.experiment), spendablePaise: Number(s.released) - Number(t.expenses), reservePaise: Number(s.reserve), cashBalancePaise: Number(t.cash), approved: true, singleLimitPaise: this.policy.singleLimitMinor, dailyLimitPaise: this.policy.dailyLimitMinor, experimentLimitPaise: this.policy.experimentLimitMinor });
    if (!result.allowed) throw new FinancialPolicyError(result.reason!);
  }
}

export async function releaseOperatingTranche(database: Database, input: {
  amountMinor: number; currency: string; approvalId: string; actorType: string; actorId: string;
}) {
  if (input.actorType !== 'owner') throw new FinancialPolicyError('owner_authority_required');
  if (!Number.isSafeInteger(input.amountMinor) || input.amountMinor <= 0 || !/^[A-Z]{3}$/.test(input.currency)) throw new FinancialPolicyError('invalid_tranche');
  const client = await database.connect();
  try {
    await client.query('BEGIN');
    const failed = await client.query("SELECT gate_key FROM readiness_gates WHERE priority='P0' AND status<>'PASS' LIMIT 1 FOR SHARE");
    if (failed.rows[0]) throw new FinancialPolicyError('p0_gate_incomplete');
    const approval = await client.query(
      `SELECT id FROM approvals WHERE id=$1 AND action_type='tranche_release' AND status='approved'
       AND expires_at>now() AND cost_minor=$2 AND currency=$3 FOR SHARE`,
      [input.approvalId,input.amountMinor,input.currency],
    );
    if (!approval.rows[0]) throw new FinancialPolicyError('owner_approval_required');
    const state = await client.query<{ available: string | number; released: string | number }>(
      'SELECT available_operating_minor AS available,released_operating_minor AS released FROM financial_policy_state WHERE currency=$1 FOR UPDATE',
      [input.currency],
    );
    if (!state.rows[0] || Number(state.rows[0].released) + input.amountMinor > Number(state.rows[0].available)) throw new FinancialPolicyError('reserve_preservation_required');
    await client.query('UPDATE financial_policy_state SET released_operating_minor=released_operating_minor+$2,updated_at=now() WHERE currency=$1', [input.currency,input.amountMinor]);
    await client.query("INSERT INTO audit_events(actor_type,actor_id,event_type,entity_type,entity_id,payload) VALUES('owner',$1,'operating_tranche_released','financial_policy_state',$2,$3)",
      [input.actorId,input.currency,JSON.stringify({ amount_minor: input.amountMinor, approval_id: input.approvalId })]);
    await client.query('COMMIT');
  } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
}
