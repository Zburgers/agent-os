import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildJobSuccessNotification,
  enqueueJobSuccessNotifications,
  loadJobSuccessNotificationConfig,
  shouldNotifyJobSuccess,
} from '../src/job-success-notifications.ts';

const job = {
  id: '11111111-1111-4111-8111-111111111111',
  action_kind: 'job' as const,
  payload: { kind: 'daily_owner_brief_snapshot' },
  idempotency_key: 'daily-brief',
  current_occurrence_key: 'daily-brief:20260809000000',
  attempts: 1,
  max_attempts: 3,
  interval_seconds: 86_400,
};

function databaseFixture(duplicate = false) {
  const calls: Array<{ sql: string; values?: unknown[] }> = [];
  let effects = 0;
  const client = { async query(sql: string, values?: unknown[]) {
    calls.push({ sql, values });
    if (sql.startsWith('SELECT pg_advisory_xact_lock')) return { rows: [] };
    if (sql.startsWith('SELECT id,state FROM effect_intents')) {
      return { rows: duplicate ? [{ id: 'effect-existing', state: 'authorized' }] : [] };
    }
    if (sql.startsWith('INSERT INTO effect_intents')) {
      effects += 1;
      return { rows: [{ id: `effect-${effects}`, state: 'proposed' }] };
    }
    if (sql.startsWith('SELECT paused,killed,commercial_lock')) {
      return { rows: [{ paused: false, killed: false, commercial_lock: false }] };
    }
    if (sql.startsWith('SELECT id FROM approvals')) return { rows: [{ id: 'policy-approval' }] };
    if (sql.startsWith("UPDATE effect_intents SET state='authorized'")) {
      return { rows: [{ id: `effect-${effects}`, state: 'authorized' }] };
    }
    if (sql.startsWith('INSERT INTO audit_events')) return { rows: [] };
    if (sql.startsWith('INSERT INTO channel_outbox')) {
      return duplicate ? { rows: [], rowCount: 0 } : { rows: [{ id: 'outbox-1' }], rowCount: 1 };
    }
    throw new Error(`unexpected query: ${sql}`);
  } };
  return { calls, client };
}

test('job success notifications trigger on completion and meaningful monitor changes only', () => {
  assert.equal(shouldNotifyJobSuccess(job, { report: 'daily_owner_brief' }), true);
  assert.equal(shouldNotifyJobSuccess({ ...job, payload: { kind: 'generic', notify_on_success: false } }, {}), false);
  assert.equal(shouldNotifyJobSuccess({ ...job, payload: { kind: 'near_bid_status_monitor' } }, {
    monitor: 'near_bid_status', alert: false,
  }), false);
  assert.equal(shouldNotifyJobSuccess({ ...job, payload: { kind: 'near_bid_status_monitor' } }, {
    monitor: 'near_bid_status', alert: true,
  }), true);
});

test('job success notification is short and does not persist credential-bearing output', () => {
  const notice = buildJobSuccessNotification({
    ...job,
    payload: { kind: 'near_bid_status_monitor', name: 'Protected bid monitor' },
  }, {
    monitor: 'near_bid_status',
    alert: true,
    bid: { status: 'awarded', budgetToken: 'should-never-persist', amount: '25' },
  });
  assert.match(notice, /^Job succeeded\nProtected bid monitor\n/);
  assert.match(notice, /NEAR bid status changed to awarded\./);
  assert.doesNotMatch(notice, /should-never-persist/);
  assert.ok(Buffer.byteLength(notice, 'utf8') <= 4096);
});

test('job success notification authorizes and enqueues one idempotent outbox row per owner', async () => {
  const { calls, client } = databaseFixture();
  const result = await enqueueJobSuccessNotifications(client, job, '33333333-3333-4333-8333-333333333333', {
    report: 'daily_owner_brief',
  }, {
    policyApprovalId: '22222222-2222-4222-8222-222222222222',
    ownerTelegramIds: ['123456', '123456', '987654'],
  });
  assert.deepEqual(result, { enqueued: 2, duplicates: 0, denied: 0 });
  assert.equal(calls.filter((call) => call.sql.startsWith('INSERT INTO effect_intents')).length, 2);
  const outboxes = calls.filter((call) => call.sql.startsWith('INSERT INTO channel_outbox'));
  assert.equal(outboxes.length, 2);
  assert.deepEqual(outboxes.map((call) => call.values?.[1]), ['123456', '987654']);
  assert.ok(outboxes.every((call) => typeof (call.values?.[3] as { text?: unknown })?.text === 'string'));
  assert.equal(JSON.stringify(calls).includes('should-never-persist'), false);
});

test('job success notification reports duplicate occurrence rows without re-enqueueing them', async () => {
  const { client } = databaseFixture(true);
  const result = await enqueueJobSuccessNotifications(client, job, '33333333-3333-4333-8333-333333333333', {
    report: 'daily_owner_brief',
  }, {
    policyApprovalId: '22222222-2222-4222-8222-222222222222',
    ownerTelegramIds: ['123456'],
  });
  assert.deepEqual(result, { enqueued: 0, duplicates: 1, denied: 0 });
});

test('job success notification fails closed when its standing policy is unavailable', async () => {
  const { calls, client } = databaseFixture();
  const result = await enqueueJobSuccessNotifications(client, job, '33333333-3333-4333-8333-333333333333', { result: 'internal_job_completed' }, {
    ownerTelegramIds: ['123456'],
  });
  assert.deepEqual(result, { enqueued: 0, duplicates: 0, denied: 1, reason: 'notification_policy_unavailable' });
  assert.equal(calls.some((call) => call.sql.startsWith('INSERT INTO channel_outbox')), false);
  assert.equal(calls.some((call) => call.sql.startsWith('INSERT INTO audit_events')), true);
});

test('job success notification configuration is environment-only and recipient-scoped', () => {
  assert.deepEqual(loadJobSuccessNotificationConfig({
    OWNER_TELEGRAM_IDS: '123456, 987654',
    TELEGRAM_NOTIFICATION_POLICY_APPROVAL_ID: '22222222-2222-4222-8222-222222222222',
    APPROVAL_TOKEN_SECRET: 'must-not-be-read',
  }), {
    policyApprovalId: '22222222-2222-4222-8222-222222222222',
    ownerTelegramIds: ['123456', '987654'],
  });
});
