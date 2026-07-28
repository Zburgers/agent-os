/** Durable, auditable approval state machine shared by dashboard, Telegram, and agent callers. */
export type ApprovalAction = 'approve' | 'reject' | 'modify' | 'comment' | 'expire' | 'cancel';
export type ApprovalActor = { type: 'owner' | 'agent' | 'telegram' | 'system'; id: string };
type QueryResult<T = Record<string, unknown>> = { rows: T[]; rowCount?: number | null };
type Client = { query<T = Record<string, unknown>>(sql: string, values?: unknown[]): Promise<QueryResult<T>>; release(): void };
type Database = { connect(): Promise<Client> };

export class ApprovalTransitionError extends Error {
  readonly reason: 'not_found' | 'already_decided' | 'expired' | 'invalid_actor' | 'invalid_modification';
  constructor(reason: 'not_found' | 'already_decided' | 'expired' | 'invalid_actor' | 'invalid_modification') { super(reason); this.reason = reason; }
}

const terminal = new Set(['approved', 'rejected', 'expired', 'cancelled']);
const newStatus: Record<ApprovalAction, string> = { approve: 'approved', reject: 'rejected', modify: 'modified', comment: 'pending', expire: 'expired', cancel: 'cancelled' };

export class ApprovalService {
  private readonly database: Database;
  constructor(database: Database) { this.database = database; }

  async transition(id: string, action: ApprovalAction, actor: ApprovalActor, note?: string, replacement?: Record<string, unknown>) {
    if (!id || !actor.id || (action === 'modify' && !replacement)) throw new ApprovalTransitionError(action === 'modify' ? 'invalid_modification' : 'invalid_actor');
    if ((action === 'approve' || action === 'reject' || action === 'modify' || action === 'cancel') && actor.type !== 'owner' && actor.type !== 'telegram') throw new ApprovalTransitionError('invalid_actor');
    const client = await this.database.connect();
    try {
      await client.query('BEGIN');
      const current = await client.query<{ id: string; status: string; expires_at: string }>('SELECT id,status,expires_at FROM approvals WHERE id=$1 FOR UPDATE', [id]);
      const approval = current.rows[0];
      if (!approval) throw new ApprovalTransitionError('not_found');
      if (terminal.has(approval.status)) throw new ApprovalTransitionError('already_decided');
      if (new Date(approval.expires_at) <= new Date() && action !== 'expire') throw new ApprovalTransitionError('expired');
      const status = newStatus[action];
      if (action !== 'comment') await client.query('UPDATE approvals SET status=$2,decided_at=CASE WHEN $2 IN (\'approved\',\'rejected\',\'expired\',\'cancelled\') THEN now() ELSE decided_at END,decided_by=CASE WHEN $2 IN (\'approved\',\'rejected\',\'expired\',\'cancelled\') THEN $3 ELSE decided_by END,decision_note=COALESCE($4,decision_note),updated_at=now() WHERE id=$1', [id, status, actor.id, note ?? null]);
      await client.query('INSERT INTO approval_events(approval_id,actor_type,actor_id,action,note,payload) VALUES($1,$2,$3,$4,$5,$6)', [id, actor.type, actor.id, `${action}${action === 'approve' ? 'd' : action === 'modify' ? 'ed' : action === 'expire' ? 'd' : action === 'cancel' ? 'led' : action === 'reject' ? 'ed' : 'ed'}`, note ?? null, JSON.stringify(replacement ?? {})]);
      await client.query('INSERT INTO audit_events(actor_type,actor_id,event_type,entity_type,entity_id,payload) VALUES($1,$2,$3,$4,$5,$6)', [actor.type, actor.id, `approval_${action}`, 'approval', id, JSON.stringify({ replacement: replacement ?? null })]);
      await client.query('COMMIT');
      return { id, status, action };
    } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
  }

  async expirePending(now = new Date()) {
    const client = await this.database.connect();
    try {
      await client.query('BEGIN');
      const expired = await client.query<{ id: string }>("UPDATE approvals SET status='expired',decided_at=now(),decided_by='system',decision_note='expired',updated_at=now() WHERE status IN ('pending','modified') AND expires_at <= $1 RETURNING id", [now]);
      for (const row of expired.rows) {
        await client.query("INSERT INTO approval_events(approval_id,actor_type,actor_id,action,note) VALUES($1,'system','approval-expirer','expired','expired')", [row.id]);
        await client.query("INSERT INTO audit_events(actor_type,actor_id,event_type,entity_type,entity_id,payload) VALUES('system','approval-expirer','approval_expired','approval',$1,'{}')", [row.id]);
      }
      await client.query('COMMIT');
      return expired.rows.map((row) => row.id);
    } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
  }
}
