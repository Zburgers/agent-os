import type { PoolClient } from 'pg';
import { readFile, stat } from 'node:fs/promises';
import { isAbsolute } from 'node:path';
import { actorContext } from './actor.ts';
import { issueApprovalToken } from './approval-token.ts';
import { authorizeEffect } from './effects.ts';

export type ApprovalNotificationInput = {
  id: string;
  actionType: string;
  requestedAction: string;
  reason: string;
  costMinor: number;
  maximumExposureMinor: number;
  currency: string;
  risk: string;
  recommendation: string;
  expiresAt: string;
};

export type ApprovalNotificationConfig = {
  policyApprovalId?: string;
  ownerTelegramIds: readonly string[];
  signingSecret?: string;
  now?: () => Date;
};

type NotificationEnvironment = Record<string, string | undefined>;

export async function loadApprovalNotificationConfig(environment: NotificationEnvironment): Promise<ApprovalNotificationConfig> {
  const secretPath = environment.APPROVAL_TOKEN_SECRET_FILE?.trim();
  let signingSecret: string | undefined;
  if (secretPath) {
    if (!isAbsolute(secretPath)) throw new Error('approval_token_secret_path');
    const metadata = await stat(secretPath);
    if (!metadata.isFile()) throw new Error('approval_token_secret_type');
    if ((metadata.mode & 0o077) !== 0) throw new Error('approval_token_secret_permissions');
    const value = (await readFile(secretPath, 'utf8')).trim();
    if (Buffer.byteLength(value, 'utf8') < 32 || Buffer.byteLength(value, 'utf8') > 4096) throw new Error('approval_token_secret_length');
    signingSecret = value;
  }
  return {
    policyApprovalId: environment.TELEGRAM_NOTIFICATION_POLICY_APPROVAL_ID?.trim() || undefined,
    ownerTelegramIds: (environment.OWNER_TELEGRAM_IDS ?? '').split(',').map((value) => value.trim()).filter(Boolean),
    signingSecret,
  };
}

type QueryClient = Pick<PoolClient, 'query'>;

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

function field(value: string, maximumBytes: number) {
  return truncateUtf8(redactCredentials(String(value).replace(/[\u0000-\u001f\u007f]/g, ' ').trim()), maximumBytes);
}

function money(amountMinor: number, currency: string) {
  if (!Number.isSafeInteger(amountMinor) || amountMinor < 0) throw new Error('invalid_notification_amount');
  const amount = BigInt(amountMinor);
  return `${currency} ${amount / 100n}.${String(amount % 100n).padStart(2, '0')}`;
}

export function buildApprovalNotification(input: ApprovalNotificationInput, signingSecret: string, now = new Date()) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(input.id)) throw new Error('invalid_notification_approval_id');
  if (Buffer.byteLength(signingSecret, 'utf8') < 32) throw new Error('invalid_notification_signing_secret');
  const expiresAt = new Date(input.expiresAt);
  if (Number.isNaN(expiresAt.valueOf()) || expiresAt <= now) throw new Error('invalid_notification_expiry');
  const currency = String(input.currency).toUpperCase();
  if (!/^[A-Z]{3}$/.test(currency)) throw new Error('invalid_notification_currency');
  const actionType = field(input.actionType, 100);
  const requestedAction = field(input.requestedAction, 900);
  const reason = field(input.reason, 600);
  const risk = field(input.risk, 600);
  const recommendation = field(input.recommendation, 700);
  if (!actionType || !requestedAction || !reason || !risk || !recommendation) throw new Error('invalid_notification_field');

  const tokenExpiry = Math.min(expiresAt.valueOf(), now.valueOf() + 30 * 60_000);
  const approve = issueApprovalToken({ approvalId: input.id, action: 'approve', expiresAt: tokenExpiry }, signingSecret);
  const reject = issueApprovalToken({ approvalId: input.id, action: 'reject', expiresAt: tokenExpiry }, signingSecret);
  const text = [
    'Approval required',
    `ID: ${input.id}`,
    `Type: ${actionType}`,
    `Action: ${requestedAction}`,
    `Reason: ${reason}`,
    `Cost: ${money(input.costMinor, currency)}`,
    `Maximum exposure: ${money(input.maximumExposureMinor, currency)}`,
    `Risk: ${risk}`,
    `Recommendation: ${recommendation}`,
    `Expires: ${expiresAt.toISOString()}`,
    '',
    'Review the exact scope in Agent OS before deciding.',
    `/approve ${approve}`,
    `/reject ${reject}`,
  ].join('\n');
  if (Buffer.byteLength(text, 'utf8') > 4096) throw new Error('notification_too_large');
  return { text, expiresAt: tokenExpiry };
}

async function auditUnavailable(client: QueryClient, approvalId: string, reason: string) {
  await client.query(
    `INSERT INTO audit_events(actor_type,actor_id,event_type,entity_type,entity_id,payload)
     VALUES('system','approval-notifier','approval_notification_not_enqueued','approval',$1,$2)`,
    [approvalId, JSON.stringify({ reason })],
  );
}

function unavailableReason(config: ApprovalNotificationConfig) {
  if (!config.policyApprovalId) return 'notification_policy_unavailable';
  if (!config.signingSecret || Buffer.byteLength(config.signingSecret, 'utf8') < 32) return 'notification_signing_secret_unavailable';
  if (config.ownerTelegramIds.length === 0) return 'owner_recipient_unavailable';
  return null;
}

async function enqueueRecipient(
  client: QueryClient,
  approval: ApprovalNotificationInput,
  config: Required<Pick<ApprovalNotificationConfig, 'policyApprovalId' | 'signingSecret'>>,
  recipient: string,
  text: string,
) {
  const key = `approval-notice:${approval.id}:telegram:${recipient}`;
  const effect = await authorizeEffect(client as PoolClient, {
    idempotencyKey: key, kind: 'message', approvalId: config.policyApprovalId,
    payload: { approvalId: approval.id, messageKind: 'approval_required' },
  }, actorContext({
    actorType: 'system', actorId: 'approval-notifier', credentialScope: 'effects:message', originPlatform: 'agent-os',
  }));
  if (effect.state !== 'authorized') return 'denied';
  const inserted = await client.query<{ id: string }>(
    `INSERT INTO channel_outbox(effect_intent_id,recipient_ref,channel,message_kind,idempotency_key,redacted_payload)
     VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(idempotency_key) DO NOTHING RETURNING id`,
    [effect.id, recipient, 'telegram', 'approval_required', key, { text }],
  );
  return inserted.rowCount === 1 || inserted.rows[0] ? 'enqueued' : 'duplicate';
}

export async function enqueueApprovalNotifications(
  client: QueryClient,
  approval: ApprovalNotificationInput,
  config: ApprovalNotificationConfig,
) {
  const reason = unavailableReason(config);
  if (reason) {
    await auditUnavailable(client, approval.id, reason);
    return { enqueued: 0, duplicates: 0, denied: 1, reason };
  }
  const recipients = [...new Set(config.ownerTelegramIds.map((value) => value.trim()))];
  if (recipients.some((recipient) => !/^\d{1,20}$/.test(recipient))) {
    await auditUnavailable(client, approval.id, 'invalid_owner_recipient');
    return { enqueued: 0, duplicates: 0, denied: 1, reason: 'invalid_owner_recipient' };
  }

  const notice = buildApprovalNotification(approval, config.signingSecret, (config.now ?? (() => new Date()))());
  let enqueued = 0;
  let duplicates = 0;
  let denied = 0;
  for (const recipient of recipients) {
    const outcome = await enqueueRecipient(client, approval, {
      policyApprovalId: config.policyApprovalId, signingSecret: config.signingSecret,
    }, recipient, notice.text);
    if (outcome === 'enqueued') enqueued += 1;
    else if (outcome === 'duplicate') duplicates += 1;
    else denied += 1;
  }
  return { enqueued, duplicates, denied };
}
