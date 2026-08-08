import type { PoolClient } from 'pg';
import { readFile, stat } from 'node:fs/promises';
import { isAbsolute } from 'node:path';
import { actorContext } from './actor.ts';
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

export type TelegramInlineButton = { text: string; callbackData: string };

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

export function buildApprovalNotification(input: ApprovalNotificationInput, now = new Date()) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(input.id)) throw new Error('invalid_notification_approval_id');
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

  const text = [
    'Approval required',
    `Reference: ${input.id.slice(0, 8)}`,
    `Type: ${actionType}`,
    `Action: ${requestedAction}`,
    `Reason: ${reason}`,
    `Cost: ${money(input.costMinor, currency)}`,
    `Maximum exposure: ${money(input.maximumExposureMinor, currency)}`,
    `Risk: ${risk}`,
    `Recommendation: ${recommendation}`,
    `Expires: ${expiresAt.toISOString()}`,
    '',
    'Review the exact scope in Agent OS, then tap Approve or Reject.',
  ].join('\n');
  if (Buffer.byteLength(text, 'utf8') > 4096) throw new Error('notification_too_large');
  const inlineKeyboard: TelegramInlineButton[][] = [[
    { text: '✅ Approve', callbackData: `ao1:approve:${input.id}` },
    { text: '❌ Reject', callbackData: `ao1:reject:${input.id}` },
  ]];
  if (inlineKeyboard.some((row) => row.some((button) => Buffer.byteLength(button.callbackData, 'utf8') > 64))) {
    throw new Error('notification_button_too_large');
  }
  return { text, inlineKeyboard, expiresAt: expiresAt.valueOf() };
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
  if (config.ownerTelegramIds.length === 0) return 'owner_recipient_unavailable';
  return null;
}

async function enqueueRecipient(
  client: QueryClient,
  approval: ApprovalNotificationInput,
  config: Pick<ApprovalNotificationConfig, 'policyApprovalId'> & { policyApprovalId: string },
  recipient: string,
  text: string,
  inlineKeyboard: TelegramInlineButton[][],
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
    [effect.id, recipient, 'telegram', 'approval_required', key, { text, inlineKeyboard }],
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

  const notice = buildApprovalNotification(approval, (config.now ?? (() => new Date()))());
  let enqueued = 0;
  let duplicates = 0;
  let denied = 0;
  for (const recipient of recipients) {
    const outcome = await enqueueRecipient(client, approval, {
      policyApprovalId: config.policyApprovalId,
    }, recipient, notice.text, notice.inlineKeyboard);
    if (outcome === 'enqueued') enqueued += 1;
    else if (outcome === 'duplicate') duplicates += 1;
    else denied += 1;
  }
  return { enqueued, duplicates, denied };
}
