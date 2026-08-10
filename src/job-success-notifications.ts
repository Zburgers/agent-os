import type { PoolClient } from 'pg';
import { actorContext } from './actor.ts';
import { authorizeEffect } from './effects.ts';
import type { Job } from './jobs.ts';

export type JobSuccessNotificationConfig = {
  policyApprovalId?: string;
  ownerTelegramIds: readonly string[];
};

type NotificationEnvironment = Record<string, string | undefined>;
type QueryClient = Pick<PoolClient, 'query'>;
type JobSuccessInput = Pick<Job, 'id' | 'payload' | 'current_occurrence_key'>;

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function loadJobSuccessNotificationConfig(environment: NotificationEnvironment): JobSuccessNotificationConfig {
  return {
    policyApprovalId: environment.TELEGRAM_NOTIFICATION_POLICY_APPROVAL_ID?.trim() || undefined,
    ownerTelegramIds: (environment.OWNER_TELEGRAM_IDS ?? '').split(',').map((value) => value.trim()).filter(Boolean),
  };
}

function redactCredentials(value: string) {
  return value
    .replace(/\bauthorization\s*:\s*bearer\s+[^\s,;]+/gi, 'Authorization: Bearer [REDACTED]')
    .replace(/\b(api[_-]?key|password|secret|token)\b\s*[:=]\s*(?:"[^"]*"|'[^']*'|[^\s,;]+)/gi, '$1=[REDACTED]')
    .replace(/-----BEGIN[^-]*PRIVATE KEY-----[\s\S]*?-----END[^-]*PRIVATE KEY-----/gi, '[REDACTED PRIVATE KEY]');
}

function truncateUtf8(value: string, maximumBytes: number) {
  let result = '';
  let bytes = 0;
  for (const character of value) {
    const width = Buffer.byteLength(character, 'utf8');
    if (bytes + width > maximumBytes) return `${result}…`;
    result += character;
    bytes += width;
  }
  return result;
}

function safeField(value: unknown, maximumBytes: number) {
  return truncateUtf8(redactCredentials(String(value ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').trim()), maximumBytes);
}

function resultKind(result: Record<string, unknown>) {
  return String(result.monitor ?? result.report ?? '');
}

export function shouldNotifyJobSuccess(job: Pick<Job, 'payload'>, result: Record<string, unknown>) {
  if (job.payload?.notify_on_success === false) return false;
  if (job.payload?.kind === 'near_bid_status_monitor') {
    return resultKind(result) === 'near_bid_status' && result.alert === true;
  }
  if (job.payload?.kind === 'payanagent_request_status_monitor') {
    return resultKind(result) === 'payanagent_request_status' && result.alert === true;
  }
  return true;
}

export function buildJobSuccessNotification(job: Pick<Job, 'payload'>, result: Record<string, unknown>) {
  const kind = safeField(job.payload?.kind ?? 'job', 100) || 'job';
  const label = safeField(job.payload?.name ?? job.payload?.label ?? kind, 180) || kind;
  let detail = 'Success criteria reached.';

  if (resultKind(result) === 'daily_owner_brief') {
    detail = 'Daily owner brief generated.';
  } else if (resultKind(result) === 'near_bid_status') {
    const bid = result.bid && typeof result.bid === 'object' ? result.bid as Record<string, unknown> : {};
    const status = safeField(bid.status ?? 'updated', 60) || 'updated';
    detail = `NEAR bid status changed to ${status}.`;
  } else if (resultKind(result) === 'payanagent_request_status') {
    const request = result.request && typeof result.request === 'object' ? result.request as Record<string, unknown> : {};
    const status = safeField(request.status ?? 'updated', 60) || 'updated';
    detail = `PayanAgent request status changed to ${status}.`;
  } else if (resultKind(result) === 'revenue_market_scout') {
    const opportunities = Array.isArray(result.opportunities) ? result.opportunities.length : 0;
    detail = `Revenue scout completed (${opportunities} opportunities).`;
  }

  return [`Job succeeded`, label, detail].join('\n');
}

async function auditUnavailable(client: QueryClient, jobId: string, reason: string) {
  await client.query(
    `INSERT INTO audit_events(actor_type,actor_id,event_type,entity_type,entity_id,payload)
     VALUES('system','job-success-notifier','job_success_notification_not_enqueued','job',$1,$2)`,
    [jobId, JSON.stringify({ reason })],
  );
}

function unavailableReason(config: JobSuccessNotificationConfig) {
  if (!config.policyApprovalId) return 'notification_policy_unavailable';
  if (!uuid.test(config.policyApprovalId)) return 'notification_policy_invalid';
  if (config.ownerTelegramIds.length === 0) return 'owner_recipient_unavailable';
  return null;
}

async function enqueueRecipient(
  client: QueryClient,
  job: JobSuccessInput,
  runId: string,
  result: Record<string, unknown>,
  policyApprovalId: string,
  recipient: string,
  text: string,
) {
  const key = `job-success:${job.id}:${job.current_occurrence_key}:telegram:${recipient}`;
  const effect = await authorizeEffect(client as PoolClient, {
    idempotencyKey: key,
    kind: 'message',
    jobId: job.id,
    runId,
    approvalId: policyApprovalId,
    payload: {
      jobId: job.id,
      occurrenceKey: job.current_occurrence_key,
      messageKind: 'job_success',
      monitor: result.monitor,
    },
  }, actorContext({
    actorType: 'system',
    actorId: 'job-success-notifier',
    credentialScope: 'effects:message',
    originPlatform: 'agent-os',
  }));
  if (effect.state !== 'authorized') return 'denied';
  const inserted = await client.query<{ id: string }>(
    `INSERT INTO channel_outbox(effect_intent_id,recipient_ref,channel,message_kind,idempotency_key,redacted_payload)
     VALUES($1,$2,'telegram','job_success',$3,$4)
     ON CONFLICT(idempotency_key) DO NOTHING RETURNING id`,
    [effect.id, recipient, key, { text }],
  );
  return inserted.rowCount === 1 || inserted.rows[0] ? 'enqueued' : 'duplicate';
}

export async function enqueueJobSuccessNotifications(
  client: QueryClient,
  job: JobSuccessInput,
  runId: string,
  result: Record<string, unknown>,
  config: JobSuccessNotificationConfig,
) {
  if (!shouldNotifyJobSuccess(job, result)) return { enqueued: 0, duplicates: 0, denied: 0, skipped: 'criteria_not_met' as const };

  const reason = unavailableReason(config);
  if (reason) {
    await auditUnavailable(client, job.id, reason);
    return { enqueued: 0, duplicates: 0, denied: 1, reason };
  }
  const recipients = [...new Set(config.ownerTelegramIds.map((value) => value.trim()))];
  if (recipients.some((recipient) => !/^\d{1,20}$/.test(recipient))) {
    await auditUnavailable(client, job.id, 'invalid_owner_recipient');
    return { enqueued: 0, duplicates: 0, denied: 1, reason: 'invalid_owner_recipient' as const };
  }

  const text = buildJobSuccessNotification(job, result);
  let enqueued = 0;
  let duplicates = 0;
  let denied = 0;
  for (const recipient of recipients) {
    const outcome = await enqueueRecipient(client, job, runId, result, config.policyApprovalId!, recipient, text);
    if (outcome === 'enqueued') enqueued += 1;
    else if (outcome === 'duplicate') duplicates += 1;
    else denied += 1;
  }
  return { enqueued, duplicates, denied };
}
