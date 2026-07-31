import test from 'node:test';
import assert from 'node:assert/strict';
import { ApprovalRequestError, ApprovalRequestService } from '../src/approval-requests.ts';

const approvalId = '11111111-1111-4111-8111-111111111111';

function fixture(duplicate = false, notifications?: ConstructorParameters<typeof ApprovalRequestService>[1]) {
  const calls: Array<{ sql: string; values?: unknown[] }> = [];
  const client = { async query(sql: string, values?: unknown[]) {
    calls.push({ sql, values });
    if (sql === 'BEGIN' || sql === 'COMMIT' || sql === 'ROLLBACK' || sql.startsWith('INSERT INTO approval_events') || sql.startsWith('INSERT INTO audit_events')) return { rows: [] };
    if (sql.startsWith('INSERT INTO approvals')) return { rows: duplicate ? [] : [{ id: approvalId, status: 'pending' }] };
    if (sql.startsWith('SELECT id,status FROM approvals')) return { rows: [{ id: approvalId, status: 'pending' }] };
    if (sql.startsWith('SELECT pg_advisory_xact_lock')) return { rows: [] };
    if (sql.startsWith('SELECT id,state FROM effect_intents')) return { rows: [] };
    if (sql.startsWith('INSERT INTO effect_intents')) return { rows: [{ id: 'effect-1', state: 'proposed' }] };
    if (sql.startsWith('SELECT paused,killed,commercial_lock')) return { rows: [{ paused: false, killed: false, commercial_lock: false }] };
    if (sql.startsWith('SELECT id FROM approvals')) return { rows: [{ id: 'policy-1' }] };
    if (sql.startsWith("UPDATE effect_intents SET state='authorized'")) return { rows: [{ id: 'effect-1', state: 'authorized' }] };
    if (sql.startsWith('INSERT INTO channel_outbox')) return { rows: [{ id: 'outbox-1' }], rowCount: 1 };
    throw new Error(`unexpected query: ${sql}`);
  }, release() {} };
  return { calls, service: new ApprovalRequestService({ connect: async () => client }, notifications) };
}

const request = { actionType: 'expense', requestedAction: 'Buy a test domain', reason: 'Validation', risk: 'Cost loss', recommendation: 'Reject unless evidence improves', idempotencyKey: 'approval-request-1', expiresAt: '2099-01-01T00:00:00.000Z', costMinor: 300, maximumExposureMinor: 300, alternatives: ['Use an existing domain'], evidence: [{ uri: 'artifact://study' }], ticketId: 'ticket-1' };

test('approval request persists required context, immutable event, and audit record atomically', async () => {
  const { calls, service } = fixture();
  assert.deepEqual(await service.request(request, { type: 'agent', id: 'goofy' }), { id: approvalId, status: 'pending', duplicate: false });
  const insert = calls.find((call) => call.sql.startsWith('INSERT INTO approvals'))!;
  assert.equal(insert.values?.[13], 'ticket-1');
  assert.equal(calls.some((call) => call.sql.startsWith('INSERT INTO approval_events')), true);
  assert.equal(calls.some((call) => call.sql.startsWith('INSERT INTO audit_events')), true);
  assert.equal(calls.at(-1)?.sql, 'COMMIT');
});

test('duplicate approval request returns the existing record and records deduplication', async () => {
  const { calls, service } = fixture(true);
  assert.deepEqual(await service.request(request, { type: 'agent', id: 'goofy' }), { id: approvalId, status: 'pending', duplicate: true });
  const event = calls.find((call) => call.sql.startsWith('INSERT INTO approval_events'))!;
  assert.equal(event.values?.[3], 'deduplicated');
});

test('approval request refuses invalid expiry before any database mutation', async () => {
  const { calls, service } = fixture();
  await assert.rejects(service.request({ ...request, expiresAt: '2000-01-01T00:00:00.000Z' }, { type: 'agent', id: 'goofy' }), (error: unknown) => error instanceof ApprovalRequestError && error.reason === 'invalid_expiry');
  assert.equal(calls.length, 0);
});

test('approval request transactionally enqueues its configured owner notification before commit', async () => {
  const { calls, service } = fixture(false, {
    policyApprovalId: '22222222-2222-4222-8222-222222222222',
    ownerTelegramIds: ['123456'],
    signingSecret: 'approval-request-test-secret-at-least-32-bytes',
    now: () => new Date('2026-08-01T00:00:00.000Z'),
  });
  const result = await service.request({
    ...request,
    expiresAt: '2099-01-01T00:00:00.000Z',
  }, { type: 'agent', id: 'goofy' });
  assert.equal(result.notification?.enqueued, 1);
  const enqueueIndex = calls.findIndex((call) => call.sql.startsWith('INSERT INTO channel_outbox'));
  const commitIndex = calls.findIndex((call) => call.sql === 'COMMIT');
  assert.ok(enqueueIndex > 0 && enqueueIndex < commitIndex);
});

test('approval request remains visible but records fail-closed evidence without notification policy', async () => {
  const { calls, service } = fixture(false, {
    ownerTelegramIds: ['123456'],
    signingSecret: 'approval-request-test-secret-at-least-32-bytes',
    now: () => new Date('2026-08-01T00:00:00.000Z'),
  });
  const result = await service.request(request, { type: 'agent', id: 'goofy' });
  assert.equal(result.notification?.reason, 'notification_policy_unavailable');
  assert.equal(calls.some((call) => call.sql.startsWith('INSERT INTO channel_outbox')), false);
  assert.equal(calls.at(-1)?.sql, 'COMMIT');
});
