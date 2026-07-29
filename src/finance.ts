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
    const totals = await client.query<{ today: string | number; experiment: string | number; expenses: string | number; cash: string | number }>("SELECT COALESCE(SUM(gross_minor) FILTER(WHERE entry_type='expense' AND payment_status='settled' AND approval_id IS NOT NULL AND occurred_at>=date_trunc('day',now())),0) AS today,COALESCE(SUM(gross_minor) FILTER(WHERE entry_type='expense' AND payment_status='settled' AND approval_id IS NOT NULL AND experiment_id=$2),0) AS experiment,COALESCE(SUM(gross_minor) FILTER(WHERE entry_type='expense' AND payment_status='settled' AND approval_id IS NOT NULL),0) AS expenses,COALESCE(SUM(net_minor) FILTER(WHERE entry_type IN ('contribution','revenue') AND payment_status='settled'),0)-COALESCE(SUM(gross_minor) FILTER(WHERE entry_type IN ('expense','refund') AND payment_status='settled'),0) AS cash FROM ledger_entries WHERE currency=$1", [entry.currency,entry.experimentId]);
    const s = state.rows[0] ?? { released: 0, reserve: 0 }; const t = totals.rows[0] ?? { today: 0, experiment: 0, expenses: 0, cash: 0 };
    const result = evaluateExpense({ amountPaise: entry.grossMinor, todaySpentPaise: Number(t.today), experimentSpentPaise: Number(t.experiment), spendablePaise: Number(s.released) - Number(t.expenses), reservePaise: Number(s.reserve), cashBalancePaise: Number(t.cash), approved: true, singleLimitPaise: this.policy.singleLimitMinor, dailyLimitPaise: this.policy.dailyLimitMinor, experimentLimitPaise: this.policy.experimentLimitMinor });
    if (!result.allowed) throw new FinancialPolicyError(result.reason!);
  }
}

export type TrancheReleaseActor = { type: 'owner' | 'telegram' | 'system'; id: string };
export type TrancheReleaseResult = {
  id: string;
  approvalId: string;
  amountMinor: number;
  currency: string;
  releasedOperatingMinor: number;
  commercialLock: boolean;
  duplicate: boolean;
};

/**
 * Executes a previously approved tranche. Amount and currency are derived from
 * the immutable owner decision rather than supplied by the executor.
 */
export async function releaseOperatingTranche(
  database: Database,
  approvalId: string,
  actor: TrancheReleaseActor,
): Promise<TrancheReleaseResult> {
  if (!approvalId.trim() || !actor.id.trim()) throw new FinancialPolicyError('invalid_tranche');
  if (!['owner','telegram','system'].includes(actor.type)) throw new FinancialPolicyError('owner_authority_required');
  const client = await database.connect();
  try {
    await client.query('BEGIN');
    const controls = await client.query<{ killed: boolean; commercial_lock: boolean }>(
      'SELECT killed,commercial_lock FROM system_controls WHERE singleton=true FOR UPDATE',
    );
    if (!controls.rows[0]) throw new FinancialPolicyError('control_state_missing');
    if (controls.rows[0].killed) throw new FinancialPolicyError('system_killed');
    const failed = await client.query("SELECT gate_key FROM readiness_gates WHERE priority='P0' AND status<>'PASS' LIMIT 1 FOR SHARE");
    if (failed.rows[0]) throw new FinancialPolicyError('p0_gate_incomplete');
    const approval = await client.query<{ id: string; cost_minor: string | number; currency: string; decided_by: string | null }>(
      `SELECT id,cost_minor,currency,decided_by FROM approvals
       WHERE id=$1 AND action_type='tranche_release' AND status='approved'
       AND expires_at>now() AND decided_at IS NOT NULL AND decided_by IS NOT NULL
       FOR SHARE`,
      [approvalId],
    );
    if (!approval.rows[0]) throw new FinancialPolicyError('owner_approval_required');
    const amountMinor = Number(approval.rows[0].cost_minor);
    const currency = approval.rows[0].currency;
    if (!Number.isSafeInteger(amountMinor) || amountMinor <= 0 || !/^[A-Z]{3}$/.test(currency)) throw new FinancialPolicyError('invalid_tranche');
    const state = await client.query<{ released: string | number; reserve: string | number }>(
      'SELECT released_operating_minor AS released,required_reserve_minor AS reserve FROM financial_policy_state WHERE currency=$1 FOR UPDATE',
      [currency],
    );
    if (!state.rows[0]) throw new FinancialPolicyError('financial_policy_state_missing');
    const prior = await client.query<{ id: string }>(
      'SELECT id FROM operating_tranche_releases WHERE approval_id=$1 FOR SHARE',
      [approvalId],
    );
    if (prior.rows[0]) {
      await client.query('COMMIT');
      return {
        id: prior.rows[0].id,
        approvalId,
        amountMinor,
        currency,
        releasedOperatingMinor: Number(state.rows[0].released),
        commercialLock: controls.rows[0].commercial_lock,
        duplicate: true,
      };
    }
    const cash = await client.query<{ cash: string | number }>(
      `SELECT
       COALESCE(SUM(net_minor) FILTER(WHERE entry_type IN ('contribution','revenue') AND payment_status='settled'),0)
       - COALESCE(SUM(gross_minor) FILTER(WHERE entry_type IN ('expense','refund') AND payment_status='settled'),0) AS cash
       FROM ledger_entries WHERE currency=$1`,
      [currency],
    );
    const released = Number(state.rows[0].released);
    const reserve = Number(state.rows[0].reserve);
    const cashMinor = Number(cash.rows[0]?.cash ?? 0);
    if (![released,reserve,cashMinor].every(Number.isSafeInteger) || released + amountMinor > cashMinor - reserve) {
      throw new FinancialPolicyError('reserve_preservation_required');
    }
    const inserted = await client.query<{ id: string }>(
      `INSERT INTO operating_tranche_releases(approval_id,currency,amount_minor,actor_type,actor_id,evidence)
       VALUES($1,$2,$3,$4,$5,$6) RETURNING id`,
      [approvalId,currency,amountMinor,actor.type,actor.id,JSON.stringify({ decided_by: approval.rows[0].decided_by, p0_verified: true })],
    );
    const updated = await client.query<{ released: string | number }>(
      `UPDATE financial_policy_state
       SET released_operating_minor=released_operating_minor+$2,updated_at=now(),updated_by=$3
       WHERE currency=$1 RETURNING released_operating_minor AS released`,
      [currency,amountMinor,`${actor.type}:${actor.id}`],
    );
    let commercialLock = controls.rows[0].commercial_lock;
    if (commercialLock) {
      await client.query(
        `UPDATE system_controls SET commercial_lock=false,updated_at=now(),updated_by=$1
         WHERE singleton=true`,
        [`${actor.type}:${actor.id}`],
      );
      await client.query(
        `INSERT INTO audit_events(actor_type,actor_id,event_type,entity_type,entity_id,payload)
         VALUES($1,$2,'commercial_lock_released','system_controls','singleton',$3)`,
        [actor.type,actor.id,JSON.stringify({ approval_id: approvalId, tranche_release_id: inserted.rows[0].id })],
      );
      commercialLock = false;
    }
    await client.query(
      `INSERT INTO audit_events(actor_type,actor_id,event_type,entity_type,entity_id,payload)
       VALUES($1,$2,'operating_tranche_released','operating_tranche_release',$3,$4)`,
      [actor.type,actor.id,inserted.rows[0].id,JSON.stringify({ amount_minor: amountMinor, currency, approval_id: approvalId })],
    );
    await client.query('COMMIT');
    return {
      id: inserted.rows[0].id,
      approvalId,
      amountMinor,
      currency,
      releasedOperatingMinor: Number(updated.rows[0].released),
      commercialLock,
      duplicate: false,
    };
  } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
}

/** Reconciles durable owner approvals that were decided before the executor ran. */
export async function reconcileApprovedOperatingTranches(
  database: Database,
  actor: TrancheReleaseActor = { type: 'system', id: 'tranche-reconciler' },
) {
  const client = await database.connect();
  let approvalIds: string[] = [];
  try {
    const approvals = await client.query<{ id: string }>(
      `SELECT a.id FROM approvals a
       LEFT JOIN operating_tranche_releases r ON r.approval_id=a.id
       WHERE a.action_type='tranche_release' AND a.status='approved'
       AND a.expires_at>now() AND a.decided_at IS NOT NULL AND a.decided_by IS NOT NULL
       AND r.id IS NULL ORDER BY a.decided_at,a.id`,
    );
    approvalIds = approvals.rows.map((row) => row.id);
  } finally { client.release(); }
  const results: TrancheReleaseResult[] = [];
  for (const id of approvalIds) results.push(await releaseOperatingTranche(database, id, actor));
  return results;
}
