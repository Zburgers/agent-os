import test from 'node:test';
import assert from 'node:assert/strict';
import { ApprovalRequestError, ApprovalRequestService } from '../src/approval-requests.ts';

function fixture(duplicate = false) {
  const calls: Array<{ sql: string; values?: unknown[] }> = [];
  const client = { async query(sql: string, values?: unknown[]) {
    calls.push({ sql, values });
    if (sql === 'BEGIN' || sql === 'COMMIT' || sql === 'ROLLBACK' || sql.startsWith('INSERT INTO approval_events') || sql.startsWith('INSERT INTO audit_events')) return { rows: [] };
    if (sql.startsWith('INSERT INTO approvals')) return { rows: duplicate ? [] : [{ id: 'approval-1', status: 'pending' }] };
    if (sql.startsWith('SELECT id,status FROM approvals')) return { rows: [{ id: 'approval-1', status: 'pending' }] };
    throw new Error(`unexpected query: ${sql}`);
  }, release() {} };
  return { calls, service: new ApprovalRequestService({ connect: async () => client }) };
}

const request = { actionType: 'expense', requestedAction: 'Buy a test domain', reason: 'Validation', risk: 'Cost loss', recommendation: 'Reject unless evidence improves', idempotencyKey: 'approval-request-1', expiresAt: '2099-01-01T00:00:00.000Z', costMinor: 300, maximumExposureMinor: 300, alternatives: ['Use an existing domain'], evidence: [{ uri: 'artifact://study' }], ticketId: 'ticket-1' };

test('approval request persists required context, immutable event, and audit record atomically', async () => {
  const { calls, service } = fixture();
  assert.deepEqual(await service.request(request, { type: 'agent', id: 'goofy' }), { id: 'approval-1', status: 'pending', duplicate: false });
  const insert = calls.find((call) => call.sql.startsWith('INSERT INTO approvals'))!;
  assert.equal(insert.values?.[13], 'ticket-1');
  assert.equal(calls.some((call) => call.sql.startsWith('INSERT INTO approval_events')), true);
  assert.equal(calls.some((call) => call.sql.startsWith('INSERT INTO audit_events')), true);
  assert.equal(calls.at(-1)?.sql, 'COMMIT');
});

test('duplicate approval request returns the existing record and records deduplication', async () => {
  const { calls, service } = fixture(true);
  assert.deepEqual(await service.request(request, { type: 'agent', id: 'goofy' }), { id: 'approval-1', status: 'pending', duplicate: true });
  const event = calls.find((call) => call.sql.startsWith('INSERT INTO approval_events'))!;
  assert.equal(event.values?.[3], 'deduplicated');
});

test('approval request refuses invalid expiry before any database mutation', async () => {
  const { calls, service } = fixture();
  await assert.rejects(service.request({ ...request, expiresAt: '2000-01-01T00:00:00.000Z' }, { type: 'agent', id: 'goofy' }), (error: unknown) => error instanceof ApprovalRequestError && error.reason === 'invalid_expiry');
  assert.equal(calls.length, 0);
});
