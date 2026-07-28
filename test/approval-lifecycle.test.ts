import test from 'node:test';
import assert from 'node:assert/strict';
import { ApprovalService, ApprovalTransitionError } from '../src/approvals.ts';

function fixture(status = 'pending') {
  const calls: Array<{ sql: string; values?: unknown[] }> = [];
  const client = { async query(sql: string, values?: unknown[]) {
    calls.push({ sql, values });
    if (sql === 'BEGIN' || sql === 'COMMIT' || sql === 'ROLLBACK' || sql.startsWith('UPDATE approvals') || sql.startsWith('INSERT INTO approval_events') || sql.startsWith('INSERT INTO audit_events')) return { rows: [] };
    if (sql.startsWith('SELECT id,status')) return { rows: [{ id: 'approval-1', status, expires_at: '2099-01-01T00:00:00.000Z' }] };
    throw new Error(`unexpected query: ${sql}`);
  }, release() {} };
  return { calls, service: new ApprovalService({ connect: async () => client }) };
}

test('owner approval changes the durable state and writes approval plus audit history atomically', async () => {
  const { calls, service } = fixture();
  assert.deepEqual(await service.transition('approval-1', 'approve', { type: 'owner', id: 'owner-1' }, 'approved'), { id: 'approval-1', status: 'approved', action: 'approve' });
  assert.equal(calls[0].sql, 'BEGIN');
  assert.equal(calls.some((call) => call.sql.startsWith('UPDATE approvals')), true);
  assert.equal(calls.some((call) => call.sql.startsWith('INSERT INTO approval_events')), true);
  assert.equal(calls.some((call) => call.sql.startsWith('INSERT INTO audit_events')), true);
  assert.equal(calls.at(-1)?.sql, 'COMMIT');
});

test('an agent cannot self-approve and a terminal approval cannot be changed', async () => {
  const { service } = fixture();
  await assert.rejects(service.transition('approval-1', 'approve', { type: 'agent', id: 'goofy' }), (error: unknown) => error instanceof ApprovalTransitionError && error.reason === 'invalid_actor');
  const terminal = fixture('rejected');
  await assert.rejects(terminal.service.transition('approval-1', 'approve', { type: 'owner', id: 'owner-1' }), (error: unknown) => error instanceof ApprovalTransitionError && error.reason === 'already_decided');
});
