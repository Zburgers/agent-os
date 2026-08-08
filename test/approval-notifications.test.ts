import test from 'node:test';
import assert from 'node:assert/strict';
import { chmod, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildApprovalNotification, enqueueApprovalNotifications, loadApprovalNotificationConfig } from '../src/approval-notifications.ts';

const now = new Date('2026-08-01T00:00:00.000Z');
const secret = 'notification-test-signing-secret-at-least-32-bytes';
const approval = {
  id: '11111111-1111-4111-8111-111111111111',
  actionType: 'expense',
  requestedAction: 'Buy one validation domain',
  reason: 'Test demand with a dedicated landing page',
  costMinor: 300,
  maximumExposureMinor: 300,
  currency: 'USD',
  risk: 'The validation may produce no qualified leads',
  recommendation: 'Approve only for the documented experiment',
  expiresAt: '2026-08-01T02:00:00.000Z',
};

test('approval notification contains exact safe fields and native approve/reject buttons', () => {
  const notice = buildApprovalNotification(approval, now);
  assert.match(notice.text, /Approval required/);
  assert.match(notice.text, /Reference: 11111111/);
  assert.doesNotMatch(notice.text, new RegExp(approval.id));
  assert.match(notice.text, /Type: expense/);
  assert.match(notice.text, /Action: Buy one validation domain/);
  assert.match(notice.text, /Reason: Test demand with a dedicated landing page/);
  assert.match(notice.text, /Cost: USD 3\.00/);
  assert.match(notice.text, /Maximum exposure: USD 3\.00/);
  assert.match(notice.text, /Risk: The validation may produce no qualified leads/);
  assert.match(notice.text, /Recommendation: Approve only for the documented experiment/);
  assert.match(notice.text, /Expires: 2026-08-01T02:00:00\.000Z/);
  assert.deepEqual(notice.inlineKeyboard, [[
    { text: '✅ Approve', callbackData: `ao1:approve:${approval.id}` },
    { text: '❌ Reject', callbackData: `ao1:reject:${approval.id}` },
  ]]);
  assert.doesNotMatch(notice.text, /\/(approve|reject) /);
  assert.ok(Buffer.byteLength(notice.text, 'utf8') <= 4096);
});

test('approval notification redacts generic credentials and remains within Telegram byte limit', () => {
  const notice = buildApprovalNotification({
    ...approval,
    requestedAction: `Configure API_KEY=should-never-persist ${'é'.repeat(8_000)}`,
    risk: 'Authorization: Bearer dangerous-runtime-token',
    recommendation: 'Use password="another-secret-value" only at runtime',
  }, now);
  assert.doesNotMatch(notice.text, /should-never-persist|dangerous-runtime-token|another-secret-value/);
  assert.match(notice.text, /\[REDACTED\]/);
  assert.ok(Buffer.byteLength(notice.text, 'utf8') <= 4096);
  assert.equal(notice.inlineKeyboard?.[0]?.[0]?.callbackData, `ao1:approve:${approval.id}`);
});

function databaseFixture(duplicate = false) {
  const calls: Array<{ sql: string; values?: unknown[] }> = [];
  let effects = 0;
  let outboxes = 0;
  const client = { async query(sql: string, values?: unknown[]) {
    calls.push({ sql, values });
    if (sql.startsWith('SELECT pg_advisory_xact_lock')) return { rows: [] };
    if (sql.startsWith('SELECT id,state FROM effect_intents')) return { rows: duplicate ? [{ id: `effect-${effects + 1}`, state: 'authorized' }] : [] };
    if (sql.startsWith('INSERT INTO effect_intents')) { effects += 1; return { rows: [{ id: `effect-${effects}`, state: 'proposed' }] }; }
    if (sql.startsWith('SELECT paused,killed,commercial_lock')) return { rows: [{ paused: false, killed: false, commercial_lock: false }] };
    if (sql.startsWith('SELECT id FROM approvals')) return { rows: [{ id: 'policy-approval' }] };
    if (sql.startsWith("UPDATE effect_intents SET state='authorized'")) return { rows: [{ id: `effect-${effects}`, state: 'authorized' }] };
    if (sql.startsWith('INSERT INTO audit_events')) return { rows: [] };
    if (sql.startsWith('INSERT INTO channel_outbox')) {
      if (duplicate) return { rows: [], rowCount: 0 };
      outboxes += 1; return { rows: [{ id: `outbox-${outboxes}` }], rowCount: 1 };
    }
    throw new Error(`unexpected query: ${sql}`);
  } };
  return { calls, client };
}

test('approval notification enqueues one authorized idempotent effect per allowlisted owner', async () => {
  const { calls, client } = databaseFixture();
  const result = await enqueueApprovalNotifications(client, approval, {
    policyApprovalId: '22222222-2222-4222-8222-222222222222',
    ownerTelegramIds: ['123456', '123456', '987654'],
    signingSecret: secret,
    now: () => now,
  });
  assert.deepEqual(result, { enqueued: 2, duplicates: 0, denied: 0 });
  const effects = calls.filter((call) => call.sql.startsWith('INSERT INTO effect_intents'));
  const outboxes = calls.filter((call) => call.sql.startsWith('INSERT INTO channel_outbox'));
  assert.equal(effects.length, 2);
  assert.equal(outboxes.length, 2);
  assert.deepEqual(outboxes.map((call) => call.values?.[1]), ['123456', '987654']);
  assert.ok(outboxes.every((call) => {
    const payload = call.values?.[5] as { text?: unknown; inlineKeyboard?: unknown };
    return typeof payload?.text === 'string' && Array.isArray(payload.inlineKeyboard);
  }));
  assert.ok(calls.every((call) => !JSON.stringify(call.values ?? []).includes(secret)));
});

test('approval notification deduplicates an existing effect and outbox', async () => {
  const { client } = databaseFixture(true);
  assert.deepEqual(await enqueueApprovalNotifications(client, approval, {
    policyApprovalId: '22222222-2222-4222-8222-222222222222', ownerTelegramIds: ['123456'], signingSecret: secret, now: () => now,
  }), { enqueued: 0, duplicates: 1, denied: 0 });
});

test('approval notification fails closed with audit evidence when policy is absent', async () => {
  const { calls, client } = databaseFixture();
  assert.deepEqual(await enqueueApprovalNotifications(client, approval, {
    ownerTelegramIds: ['123456'], signingSecret: secret, now: () => now,
  }), { enqueued: 0, duplicates: 0, denied: 1, reason: 'notification_policy_unavailable' });
  assert.equal(calls.some((call) => call.sql.startsWith('INSERT INTO effect_intents')), false);
  assert.equal(calls.some((call) => call.sql.startsWith('INSERT INTO channel_outbox')), false);
  const audit = calls.find((call) => call.sql.startsWith('INSERT INTO audit_events'));
  assert.ok(audit);
  assert.equal(JSON.stringify(audit.values).includes(secret), false);
});

test('approval notification rejects invalid recipients instead of accepting request data', async () => {
  const { calls, client } = databaseFixture();
  assert.deepEqual(await enqueueApprovalNotifications(client, approval, {
    policyApprovalId: '22222222-2222-4222-8222-222222222222', ownerTelegramIds: ['123456', 'telegram:attacker'], signingSecret: secret, now: () => now,
  }), { enqueued: 0, duplicates: 0, denied: 1, reason: 'invalid_owner_recipient' });
  assert.equal(calls.some((call) => call.sql.startsWith('INSERT INTO channel_outbox')), false);
});

test('approval notification config loads signing material only from a protected runtime file', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'goofy-approval-secret-'));
  const path = join(directory, 'approval-token.key');
  await writeFile(path, secret, { mode: 0o600 });
  await chmod(path, 0o600);
  const config = await loadApprovalNotificationConfig({
    OWNER_TELEGRAM_IDS: '123456,987654',
    TELEGRAM_NOTIFICATION_POLICY_APPROVAL_ID: '22222222-2222-4222-8222-222222222222',
    APPROVAL_TOKEN_SECRET_FILE: path,
  });
  assert.deepEqual(config.ownerTelegramIds, ['123456', '987654']);
  assert.equal(config.policyApprovalId, '22222222-2222-4222-8222-222222222222');
  assert.equal(config.signingSecret, secret);

  await chmod(path, 0o644);
  await assert.rejects(loadApprovalNotificationConfig({ APPROVAL_TOKEN_SECRET_FILE: path }), /approval_token_secret_permissions/);
});

test('approval notification config never accepts signing material directly from environment', async () => {
  const config = await loadApprovalNotificationConfig({
    OWNER_TELEGRAM_IDS: '123456',
    APPROVAL_TOKEN_SECRET: secret,
  });
  assert.equal(config.signingSecret, undefined);
});
