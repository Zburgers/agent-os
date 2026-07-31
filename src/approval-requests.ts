import { enqueueApprovalNotifications, type ApprovalNotificationConfig } from './approval-notifications.ts';

export type ApprovalRequestActor = { type: 'owner' | 'agent' | 'telegram' | 'system'; id: string };
export type ApprovalRequestInput = {
  actionType: string; requestedAction: string; reason: string; risk: string; recommendation: string; idempotencyKey: string; expiresAt: string;
  costMinor?: number; maximumExposureMinor?: number; currency?: string; alternatives?: string[]; evidence?: unknown[]; defaultAction?: string;
  objectiveId?: string; ventureId?: string; experimentId?: string; ticketId?: string; blocker?: string;
};
type QueryResult<T = Record<string, unknown>> = { rows: T[]; rowCount?: number | null };
type Client = { query<T = Record<string, unknown>>(sql: string, values?: unknown[]): Promise<QueryResult<T>>; release(): void };
type Database = { connect(): Promise<Client> };
export class ApprovalRequestError extends Error { readonly reason: string; constructor(reason: string) { super(reason); this.reason = reason; } }

function required(value: unknown, field: string) {
  if (typeof value !== 'string' || !value.trim() || value.length > 10_000) throw new ApprovalRequestError(`invalid_${field}`);
  return value.trim();
}
function optional(value: unknown, field: string) { if (value === undefined || value === null || value === '') return null; return required(value, field); }
function amount(value: number | undefined, field: string) { if (value === undefined) return 0; if (!Number.isSafeInteger(value) || value < 0) throw new ApprovalRequestError(`invalid_${field}`); return value; }
function list(value: unknown, field: string) { if (value === undefined) return []; if (!Array.isArray(value) || !value.every((item) => typeof item === 'string' && item.trim() && item.length <= 10_000)) throw new ApprovalRequestError(`invalid_${field}`); return value.map((item) => item.trim()); }
function evidence(value: unknown) { if (value === undefined) return []; if (!Array.isArray(value)) throw new ApprovalRequestError('invalid_evidence'); return value; }

/** Creates one precise approval request or returns its durable idempotent predecessor. */
export class ApprovalRequestService {
  private readonly database: Database;
  private readonly notificationConfig?: ApprovalNotificationConfig;
  constructor(database: Database, notificationConfig?: ApprovalNotificationConfig) {
    this.database = database;
    this.notificationConfig = notificationConfig;
  }
  async request(input: ApprovalRequestInput, actor: ApprovalRequestActor) {
    const expiresAt = new Date(required(input.expiresAt, 'expires_at'));
    if (Number.isNaN(expiresAt.valueOf()) || expiresAt <= new Date()) throw new ApprovalRequestError('invalid_expiry');
    const currency = (input.currency ?? 'INR').toUpperCase(); if (!/^[A-Z]{3}$/.test(currency)) throw new ApprovalRequestError('invalid_currency');
    const values = [required(input.actionType,'action_type'),required(input.requestedAction,'requested_action'),required(input.reason,'reason'),amount(input.costMinor,'cost_minor'),currency,required(input.risk,'risk'),JSON.stringify(list(input.alternatives,'alternatives')),required(input.recommendation,'recommendation'),required(input.idempotencyKey,'idempotency_key'),expiresAt,optional(input.objectiveId,'objective_id'),optional(input.ventureId,'venture_id'),optional(input.experimentId,'experiment_id'),optional(input.ticketId,'ticket_id'),optional(input.blocker,'blocker'),amount(input.maximumExposureMinor,'maximum_exposure_minor'),JSON.stringify(evidence(input.evidence)),optional(input.defaultAction,'default_action') ?? 'expire_without_execution'];
    const client = await this.database.connect();
    try {
      await client.query('BEGIN');
      const inserted = await client.query<{ id: string; status: string }>(`INSERT INTO approvals(action_type,requested_action,reason,cost_minor,currency,risk,alternatives,recommendation,idempotency_key,expires_at,objective_id,venture_id,experiment_id,task_id,blocker,maximum_exposure_minor,evidence,default_action)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
        ON CONFLICT(idempotency_key) DO NOTHING RETURNING id,status`, values);
      const duplicate = !inserted.rows[0];
      const record = inserted.rows[0] ?? (await client.query<{ id: string; status: string }>('SELECT id,status FROM approvals WHERE idempotency_key=$1 FOR SHARE', [values[8]])).rows[0];
      if (!record) throw new ApprovalRequestError('idempotency_lookup_failed');
      const action = duplicate ? 'deduplicated' : 'requested';
      await client.query('INSERT INTO approval_events(approval_id,actor_type,actor_id,action,payload) VALUES($1,$2,$3,$4,$5)', [record.id, actor.type, actor.id, action, JSON.stringify({ idempotency_key: values[8] })]);
      await client.query('INSERT INTO audit_events(actor_type,actor_id,event_type,entity_type,entity_id,payload) VALUES($1,$2,$3,$4,$5,$6)', [actor.type, actor.id, `approval_${action}`, 'approval', record.id, JSON.stringify({ idempotency_key: values[8] })]);
      let notification;
      if (this.notificationConfig) {
        notification = duplicate
          ? { enqueued: 0, duplicates: 1, denied: 0 }
          : await enqueueApprovalNotifications(client as Parameters<typeof enqueueApprovalNotifications>[0], {
            id: record.id, actionType: values[0] as string, requestedAction: values[1] as string,
            reason: values[2] as string, costMinor: values[3] as number, currency: values[4] as string,
            risk: values[5] as string, recommendation: values[7] as string,
            expiresAt: expiresAt.toISOString(), maximumExposureMinor: values[15] as number,
          }, this.notificationConfig);
      }
      await client.query('COMMIT');
      return notification ? { ...record, duplicate, notification } : { ...record, duplicate };
    } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
  }
}
