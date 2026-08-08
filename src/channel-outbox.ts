import type { PoolClient } from 'pg';

type QueryResult<T = Record<string, unknown>> = { rows: T[]; rowCount?: number | null };
type Client = Pick<PoolClient, 'query'> & { release(): void };
type Database = { connect(): Promise<Client> };
type DeliveryRow = {
  id: string;
  effect_intent_id: string;
  channel: string;
  recipient_ref: string;
  message_kind: string;
  redacted_payload: { text?: unknown; inlineKeyboard?: unknown };
  status: string;
  attempts: number;
  max_attempts: number;
  lease_expires_at: string | null;
};
export type ChannelDeliveryResult = {
  outcome: 'succeeded' | 'failed' | 'ambiguous';
  receipt?: Record<string, unknown>;
  error?: string;
};

export class ChannelOutboxError extends Error {
  readonly code: string;
  constructor(code: string) { super(code); this.code = code; }
}

function safeError(value: unknown) {
  return String(value ?? 'delivery_failed')
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\bauthorization\s*:\s*bearer\s+[^\s,;]+/gi, 'Authorization: Bearer [REDACTED]')
    .replace(/\b(api[_-]?key|password|secret|token)\b\s*[:=]\s*[^\s,;]+/gi, '$1=[REDACTED]')
    .slice(0, 500);
}

function sanitizedReceipt(value: Record<string, unknown> | undefined) {
  const result: Record<string, string> = {};
  const status = String(value?.providerStatus ?? '');
  const messageId = String(value?.messageId ?? '');
  const chatId = String(value?.chatId ?? '');
  if (/^[a-z0-9_-]{1,32}$/i.test(status)) result.provider_status = status;
  if (/^-?\d{1,32}$/.test(messageId)) result.message_id = messageId;
  if (/^-?\d{1,32}$/.test(chatId)) result.chat_id = chatId;
  return result;
}

function inlineKeyboard(value: unknown) {
  if (value === undefined) return undefined;
  if (!Array.isArray(value) || value.length < 1 || value.length > 4) throw new ChannelOutboxError('invalid_delivery_buttons');
  const keyboard = value.map((row) => {
    if (!Array.isArray(row) || row.length < 1 || row.length > 3) throw new ChannelOutboxError('invalid_delivery_buttons');
    return row.map((button) => {
      if (!button || typeof button !== 'object') throw new ChannelOutboxError('invalid_delivery_buttons');
      const text = String((button as { text?: unknown }).text ?? '');
      const callbackData = String((button as { callbackData?: unknown }).callbackData ?? '');
      if (!text || Buffer.byteLength(text, 'utf8') > 64 || !callbackData || Buffer.byteLength(callbackData, 'utf8') > 64) {
        throw new ChannelOutboxError('invalid_delivery_buttons');
      }
      return { text, callbackData };
    });
  });
  return keyboard;
}

async function auditDelivery(client: Client, id: string, eventType: string, payload: Record<string, unknown>) {
  await client.query(
    `INSERT INTO audit_events(actor_type,actor_id,event_type,entity_type,entity_id,payload)
     VALUES('worker','channel-relay',$1,'channel_outbox',$2,$3)`,
    [eventType, id, JSON.stringify(payload)],
  );
}

export class ChannelOutboxService {
  private readonly database: Database;
  private readonly leaseSeconds: number;
  private readonly ownerTelegramIds: readonly string[];
  constructor(database: Database, options: { leaseSeconds?: number; ownerTelegramIds?: readonly string[] } = {}) {
    this.database = database;
    this.leaseSeconds = options.leaseSeconds ?? 60;
    this.ownerTelegramIds = [...new Set(options.ownerTelegramIds ?? [])];
    if (!Number.isSafeInteger(this.leaseSeconds) || this.leaseSeconds < 15 || this.leaseSeconds > 300) throw new ChannelOutboxError('invalid_lease_seconds');
    if (this.ownerTelegramIds.some((value) => !/^\d{1,20}$/.test(value))) throw new ChannelOutboxError('invalid_owner_recipient');
  }

  private async reconcileStale(client: Client) {
    const stale = await client.query<DeliveryRow>(
      `SELECT id,effect_intent_id,status,attempts,max_attempts,channel,recipient_ref,message_kind,redacted_payload,lease_expires_at
       FROM channel_outbox WHERE status='delivering' AND lease_expires_at<=now()
       ORDER BY lease_expires_at FOR UPDATE SKIP LOCKED LIMIT 20`,
    );
    for (const row of stale.rows) {
      const outbox = await client.query(
        `UPDATE channel_outbox SET status='reconciliation_required',lease_expires_at=NULL,
         last_error='stale_delivery_lease',updated_at=now() WHERE id=$1 AND status='delivering'`,
        [row.id],
      );
      const effect = await client.query(
        `UPDATE effect_intents SET state='reconciliation_required',last_error='stale_delivery_lease',
         finished_at=now(),updated_at=now() WHERE id=$1 AND state='executing'`,
        [row.effect_intent_id],
      );
      if (!outbox.rowCount || !effect.rowCount) throw new ChannelOutboxError('stale_delivery_state_mismatch');
      await auditDelivery(client, row.id, 'channel_delivery_reconciliation_required', { reason: 'stale_lease', attempt: row.attempts });
    }
  }

  private async claimCandidate(client: Client) {
    const claimed = await client.query<DeliveryRow>(
      `WITH candidate AS (
         SELECT id FROM channel_outbox WHERE status='pending' AND channel='telegram'
           AND recipient_ref=ANY($2::text[]) AND attempts<max_attempts AND next_attempt_at<=now()
         ORDER BY next_attempt_at,created_at FOR UPDATE SKIP LOCKED LIMIT 1
       )
       UPDATE channel_outbox SET status='delivering',attempts=attempts+1,
         lease_expires_at=now()+($1 * interval '1 second'),updated_at=now()
       WHERE id IN (SELECT id FROM candidate)
       RETURNING id,effect_intent_id,status,attempts,max_attempts,channel,recipient_ref,message_kind,redacted_payload,lease_expires_at`,
      [this.leaseSeconds, this.ownerTelegramIds],
    );
    return claimed.rows[0] ?? null;
  }

  private async consumeEffect(client: Client, row: DeliveryRow) {
    const effect = await client.query(
      `UPDATE effect_intents SET state='executing',executing_at=COALESCE(executing_at,now()),updated_at=now()
       WHERE id=$1 AND effect_kind='message' AND state IN ('authorized','executing') RETURNING id`,
      [row.effect_intent_id],
    );
    if (!effect.rowCount && !effect.rows[0]) throw new ChannelOutboxError('message_effect_unavailable');
  }

  private delivery(row: DeliveryRow) {
    const text = row.redacted_payload?.text;
    if (row.channel !== 'telegram' || typeof text !== 'string' || !text || Buffer.byteLength(text, 'utf8') > 4096) {
      throw new ChannelOutboxError('invalid_delivery_payload');
    }
    const buttons = inlineKeyboard(row.redacted_payload?.inlineKeyboard);
    return {
      id: row.id, channel: row.channel, recipientRef: row.recipient_ref,
      messageKind: row.message_kind, text, ...(buttons ? { inlineKeyboard: buttons } : {}), attempt: row.attempts,
    };
  }

  async claim() {
    const client = await this.database.connect();
    try {
      await client.query('BEGIN');
      await this.reconcileStale(client);
      const controls = await client.query<{ paused: boolean; killed: boolean; commercial_lock: boolean }>(
        'SELECT paused,killed,commercial_lock FROM system_controls WHERE singleton=true FOR SHARE',
      );
      const state = controls.rows[0];
      if (!state) throw new ChannelOutboxError('controls_unavailable');
      const reason = state?.killed ? 'system_killed' : state?.paused ? 'system_paused' : state?.commercial_lock ? 'commercial_lock' : null;
      if (reason) { await client.query('COMMIT'); return { claimed: false as const, reason }; }
      if (this.ownerTelegramIds.length === 0) {
        await client.query('COMMIT');
        return { claimed: false as const, reason: 'owner_recipient_unavailable' };
      }

      const row = await this.claimCandidate(client);
      if (!row) { await client.query('COMMIT'); return { claimed: false as const, reason: 'empty' }; }
      await this.consumeEffect(client, row);
      const delivery = this.delivery(row);
      await auditDelivery(client, row.id, 'channel_delivery_claimed', { channel: row.channel, message_kind: row.message_kind, attempt: row.attempts });
      await client.query('COMMIT');
      return { claimed: true as const, delivery };
    } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
  }

  async recordResult(id: string, attempt: number, result: ChannelDeliveryResult) {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) throw new ChannelOutboxError('invalid_delivery_id');
    if (!Number.isSafeInteger(attempt) || attempt < 1) throw new ChannelOutboxError('invalid_delivery_attempt');
    if (!['succeeded', 'failed', 'ambiguous'].includes(result.outcome)) throw new ChannelOutboxError('invalid_delivery_outcome');
    const client = await this.database.connect();
    try {
      await client.query('BEGIN');
      const selected = await client.query<DeliveryRow>(
        `SELECT id,effect_intent_id,status,attempts,max_attempts,channel,recipient_ref,message_kind,redacted_payload,lease_expires_at
         FROM channel_outbox WHERE id=$1 FOR UPDATE`,
        [id],
      );
      const row = selected.rows[0];
      if (!row) throw new ChannelOutboxError('delivery_not_found');
      if (row.status !== 'delivering') throw new ChannelOutboxError('invalid_delivery_state');
      if (row.channel !== 'telegram' || !this.ownerTelegramIds.includes(row.recipient_ref)) throw new ChannelOutboxError('invalid_owner_recipient');
      if (row.attempts !== attempt) throw new ChannelOutboxError('delivery_attempt_mismatch');
      const outcome = await this.finishResult(client, row, result);
      await client.query('COMMIT');
      return outcome;
    } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
  }

  private async finishResult(client: Client, row: DeliveryRow, result: ChannelDeliveryResult) {
    if (result.outcome === 'failed' && row.attempts < row.max_attempts) {
      const delay = Math.min(300, 30 * (2 ** (row.attempts - 1)));
      await client.query(
        `UPDATE channel_outbox SET status='pending',lease_expires_at=NULL,next_attempt_at=now()+($3 * interval '1 second'),
         last_error=$2,updated_at=now() WHERE id=$1`,
        [row.id, safeError(result.error), delay],
      );
      await auditDelivery(client, row.id, 'channel_delivery_retry_scheduled', { attempt: row.attempts, delay_seconds: delay });
      return { id: row.id, status: 'pending', retry: true };
    }

    const status = result.outcome === 'succeeded' ? 'delivered'
      : result.outcome === 'ambiguous' ? 'reconciliation_required' : 'failed';
    const effectState = result.outcome === 'succeeded' ? 'succeeded'
      : result.outcome === 'ambiguous' ? 'reconciliation_required' : 'failed';
    const receipt = result.outcome === 'succeeded' ? sanitizedReceipt(result.receipt) : null;
    await client.query(
      `UPDATE channel_outbox SET status=$2,provider_receipt=$3,last_error=$4,lease_expires_at=NULL,
       delivered_at=CASE WHEN $2='delivered' THEN now() ELSE delivered_at END,updated_at=now() WHERE id=$1`,
      [row.id, status, receipt, result.outcome === 'succeeded' ? null : safeError(result.error)],
    );
    const effect = await client.query(
      `UPDATE effect_intents SET state=$2,receipt=$3,last_error=$4,finished_at=now(),updated_at=now()
       WHERE id=$1 AND state='executing'`,
      [row.effect_intent_id, effectState, receipt, result.outcome === 'succeeded' ? null : safeError(result.error)],
    );
    if (!effect.rowCount) throw new ChannelOutboxError('message_effect_state_mismatch');
    await auditDelivery(client, row.id, `channel_delivery_${status}`, { attempt: row.attempts, status });
    return { id: row.id, status, retry: false };
  }
}
