import type { RevenueTrack, RevenueTrackOwnerKind, RevenueTrackStatus } from './entities.ts';

type QueryResult<T = Record<string, unknown>> = { rows: T[]; rowCount?: number | null };
type Client = { query<T = Record<string, unknown>>(sql: string, values?: unknown[]): Promise<QueryResult<T>>; release(): void };
type Database = { connect(): Promise<Client> };
export type TrackActor = { type: 'owner' | 'agent' | 'worker' | 'system'; id: string };
export type RevenueTrackInput = {
  name: string; parentTrackId?: string | null; ownerKind?: RevenueTrackOwnerKind; status?: RevenueTrackStatus;
  strategy?: string; targetCustomer?: string; monetizationModel?: string; stage?: string; confidence?: number | null;
  priority?: number; expectedValue?: number | string | null; plannedCostMinor?: number; currentAction?: string | null;
  nextAction?: string | null; reviewDate?: string | null; successCriteria?: string | null; killCriteria?: string | null;
};
export type RevenueTrackUpdate = Partial<Omit<RevenueTrackInput, 'parentTrackId'>>;
export class RevenueTrackValidationError extends Error { readonly reason: string; constructor(reason: string) { super(reason); this.reason = reason; } }

const statuses: readonly string[] = ['proposed', 'active', 'paused', 'completed', 'killed'];
const owners: readonly string[] = ['agent', 'owner', 'joint'];
function requiredText(value: unknown, field: string, max = 10_000) {
  if (typeof value !== 'string' || !value.trim()) throw new RevenueTrackValidationError(`missing_${field}`);
  if (value.trim().length > max) throw new RevenueTrackValidationError(`invalid_${field}`);
  return value.trim();
}
function optionalText(value: unknown, field: string, max = 10_000) {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string' || value.trim().length > max) throw new RevenueTrackValidationError(`invalid_${field}`);
  return value.trim();
}
function integer(value: unknown, field: string, minimum = 0) {
  if (value === undefined || value === null) return null;
  if (!Number.isSafeInteger(value) || Number(value) < minimum) throw new RevenueTrackValidationError(`invalid_${field}`);
  return value;
}
function confidence(value: unknown) {
  const parsed = integer(value, 'confidence', 0);
  if (parsed !== null && Number(parsed) > 100) throw new RevenueTrackValidationError('invalid_confidence');
  return parsed;
}
function validateStatus(value: unknown) { if (!statuses.includes(String(value))) throw new RevenueTrackValidationError('invalid_status'); return value as RevenueTrackStatus; }
function validateOwner(value: unknown) { if (!owners.includes(String(value))) throw new RevenueTrackValidationError('invalid_owner_kind'); return value as RevenueTrackOwnerKind; }

export class RevenueTrackService {
  private readonly database: Database;
  constructor(database: Database) { this.database = database; }

  async create(input: RevenueTrackInput, actor: TrackActor, idempotencyKey?: string) {
    const name = requiredText(input.name, 'name', 200);
    const ownerKind = validateOwner(input.ownerKind ?? 'agent');
    const status = validateStatus(input.status ?? 'proposed');
    const stage = requiredText(input.stage ?? 'discovery', 'stage', 80);
    const values = [name, input.parentTrackId ?? null, ownerKind, status, optionalText(input.strategy, 'strategy'), optionalText(input.targetCustomer, 'target_customer'), optionalText(input.monetizationModel, 'monetization_model'), stage, confidence(input.confidence), integer(input.priority ?? 0, 'priority', -Number.MAX_SAFE_INTEGER), input.expectedValue ?? null, integer(input.plannedCostMinor ?? 0, 'planned_cost_minor'), optionalText(input.currentAction, 'current_action'), optionalText(input.nextAction, 'next_action'), optionalText(input.reviewDate, 'review_date'), optionalText(input.successCriteria, 'success_criteria'), optionalText(input.killCriteria, 'kill_criteria'), actor.id];
    const client = await this.database.connect();
    try {
      await client.query('BEGIN');
      const existing = await this.idempotent(client, idempotencyKey);
      if (existing) { await client.query('COMMIT'); return existing; }
      const result = await client.query<RevenueTrack>('INSERT INTO revenue_tracks(name,parent_track_id,owner_kind,status,strategy,target_customer,monetization_model,stage,confidence,priority,expected_value,planned_cost_minor,current_action,next_action,review_date,success_criteria,kill_criteria,created_by,updated_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$18) RETURNING *', values);
      const track = result.rows[0];
      await this.audit(client, 'revenue_track_created', track.id, actor, {});
      await this.recordIdempotency(client, idempotencyKey, track.id);
      await client.query('COMMIT');
      return track;
    } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
  }

  async update(id: string, input: RevenueTrackUpdate, actor: TrackActor, idempotencyKey?: string) {
    if (!id) throw new RevenueTrackValidationError('not_found');
    const fields: Array<[string, unknown]> = [];
    const textFields: Array<[keyof RevenueTrackUpdate, string, number?]> = [['name', 'name', 200], ['strategy', 'strategy'], ['targetCustomer', 'target_customer'], ['monetizationModel', 'monetization_model'], ['stage', 'stage', 80], ['currentAction', 'current_action'], ['nextAction', 'next_action'], ['reviewDate', 'review_date'], ['successCriteria', 'success_criteria'], ['killCriteria', 'kill_criteria']];
    for (const [key, column, max] of textFields) if (input[key] !== undefined) fields.push([column, key === 'name' || key === 'stage' ? requiredText(input[key], column, max) : optionalText(input[key], column, max)]);
    if (input.ownerKind !== undefined) fields.push(['owner_kind', validateOwner(input.ownerKind)]);
    if (input.status !== undefined) fields.push(['status', validateStatus(input.status)]);
    if (input.confidence !== undefined) fields.push(['confidence', confidence(input.confidence)]);
    if (input.priority !== undefined) fields.push(['priority', integer(input.priority, 'priority', -Number.MAX_SAFE_INTEGER)]);
    if (input.expectedValue !== undefined) fields.push(['expected_value', input.expectedValue]);
    if (input.plannedCostMinor !== undefined) fields.push(['planned_cost_minor', integer(input.plannedCostMinor, 'planned_cost_minor')]);
    if (!fields.length) throw new RevenueTrackValidationError('no_changes');
    return this.mutate(id, fields, actor, 'revenue_track_updated', idempotencyKey);
  }

  async reparent(id: string, parentTrackId: string | null, actor: TrackActor, idempotencyKey?: string) { return this.mutate(id, [['parent_track_id', parentTrackId]], actor, 'revenue_track_reparented', idempotencyKey); }
  async archive(id: string, status: 'completed' | 'killed', actor: TrackActor, idempotencyKey?: string) { return this.mutate(id, [['status', validateStatus(status)]], actor, 'revenue_track_archived', idempotencyKey); }

  async listTree() {
    const result = await this.database.connect();
    try {
      const rows = await result.query<RevenueTrack>('WITH RECURSIVE tree AS (SELECT rt.*, ARRAY[rt.name]::text[] AS path FROM revenue_tracks rt WHERE rt.parent_track_id IS NULL UNION ALL SELECT child.*, parent.path || child.name FROM revenue_tracks child JOIN tree parent ON child.parent_track_id=parent.id) SELECT id,parent_track_id,name,owner_kind,status,strategy,target_customer,monetization_model,stage,confidence,priority,expected_value,planned_cost_minor,current_action,next_action,review_date,success_criteria,kill_criteria,created_at,updated_at,created_by,updated_by FROM tree ORDER BY path, priority DESC, name ASC');
      return rows.rows;
    } finally { result.release(); }
  }

  async detail(id: string) {
    const client = await this.database.connect();
    try {
      const result = await client.query<RevenueTrack & { child_count: string; owner_handoff_count: string; settled_revenue_minor: string; settled_expense_minor: string; settled_net_minor: string }>('SELECT rt.*, (SELECT count(*) FROM revenue_tracks child WHERE child.parent_track_id=rt.id)::text AS child_count, (SELECT count(*) FROM tasks t WHERE t.track_id=rt.id AND t.status=\'waiting_for_owner\')::text AS owner_handoff_count, (SELECT COALESCE(sum(l.net_minor),0) FROM ledger_entries l WHERE l.track_id=rt.id AND l.entry_type=\'revenue\' AND l.payment_status=\'settled\')::text AS settled_revenue_minor, (SELECT COALESCE(sum(l.gross_minor),0) FROM ledger_entries l WHERE l.track_id=rt.id AND l.entry_type=\'expense\' AND l.payment_status=\'settled\')::text AS settled_expense_minor, ((SELECT COALESCE(sum(l.net_minor),0) FROM ledger_entries l WHERE l.track_id=rt.id AND l.entry_type=\'revenue\' AND l.payment_status=\'settled\')-(SELECT COALESCE(sum(l.gross_minor),0) FROM ledger_entries l WHERE l.track_id=rt.id AND l.entry_type=\'expense\' AND l.payment_status=\'settled\'))::text AS settled_net_minor FROM revenue_tracks rt WHERE rt.id=$1', [id]);
      const row = result.rows[0];
      if (!row) return null;
      return { ...row, metrics: { childCount: Number(row.child_count), ownerHandoffCount: Number(row.owner_handoff_count), settledRevenueMinor: Number(row.settled_revenue_minor), settledExpenseMinor: Number(row.settled_expense_minor), settledNetMinor: Number(row.settled_net_minor) } };
    } finally { client.release(); }
  }

  private async mutate(id: string, fields: Array<[string, unknown]>, actor: TrackActor, event: string, idempotencyKey?: string) {
    const client = await this.database.connect();
    try {
      await client.query('BEGIN');
      const existing = await this.idempotent(client, idempotencyKey);
      if (existing) { await client.query('COMMIT'); return existing; }
      const values = fields.map(([, value]) => value);
      const setters = fields.map(([column], index) => `${column}=$${index + 1}`).join(',');
      const result = await client.query<RevenueTrack>(`UPDATE revenue_tracks SET ${setters},updated_at=now(),updated_by=$${values.length + 2} WHERE id=$${values.length + 1} RETURNING *`, [...values, id, actor.id]);
      if (!result.rows[0]) throw new RevenueTrackValidationError('not_found');
      await this.audit(client, event, id, actor, { fields: fields.map(([field]) => field) });
      await this.recordIdempotency(client, idempotencyKey, id);
      await client.query('COMMIT');
      return result.rows[0];
    } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
  }

  private async idempotent(client: Client, key?: string) {
    if (!key?.trim()) return null;
    await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [key]);
    const prior = await client.query<{ entity_id: string }>("SELECT entity_id FROM audit_events WHERE event_type='revenue_track_idempotency' AND payload->>'idempotency_key'=$1 ORDER BY id DESC LIMIT 1", [key]);
    if (!prior.rows[0]) return null;
    const current = await client.query<RevenueTrack>('SELECT * FROM revenue_tracks WHERE id=$1', [prior.rows[0].entity_id]);
    return current.rows[0] ?? null;
  }

  private async recordIdempotency(client: Client, key: string | undefined, id: string) {
    if (!key?.trim()) return;
    await client.query('INSERT INTO audit_events(actor_type,actor_id,event_type,entity_type,entity_id,payload) VALUES($1,$2,$3,$4,$5,$6)', ['system', 'idempotency', 'revenue_track_idempotency', 'revenue_track', id, JSON.stringify({ idempotency_key: key })]);
  }

  private async audit(client: Client, event: string, id: string, actor: TrackActor, payload: Record<string, unknown>) {
    await client.query('INSERT INTO audit_events(actor_type,actor_id,event_type,entity_type,entity_id,payload) VALUES($1,$2,$3,$4,$5,$6)', [actor.type, actor.id, event, 'revenue_track', id, JSON.stringify(payload)]);
  }
}
