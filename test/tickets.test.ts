import test from 'node:test';
import assert from 'node:assert/strict';
import { TicketService, TicketValidationError } from '../src/tickets.ts';

function fixture() {
  const calls: Array<{ sql: string; values?: unknown[] }> = [];
  const client = { async query(sql: string, values?: unknown[]) {
    calls.push({ sql, values });
    if (sql === 'BEGIN' || sql === 'COMMIT' || sql === 'ROLLBACK' || sql.startsWith('INSERT INTO activity_events') || sql.startsWith('INSERT INTO audit_events')) return { rows: [] };
    if (sql.startsWith('INSERT INTO tasks')) return { rows: [{ id: 'ticket-1' }] };
    if (sql.startsWith('UPDATE tasks')) return { rows: [{ id: 'ticket-1' }] };
    throw new Error(`unexpected query: ${sql}`);
  }, release() {} };
  return { calls, service: new TicketService({ connect: async () => client }) };
}

test('agent ticket creation creates one durable ticket and immutable activity/audit records', async () => {
  const { calls, service } = fixture();
  assert.deepEqual(await service.create({ title: 'Verify ledger policy', status: 'ready', priority: 3, acceptanceCriteria: 'test passes' }, { type: 'agent', id: 'goofy' }), { id: 'ticket-1', status: 'ready' });
  assert.equal(calls.some((call) => call.sql.startsWith('INSERT INTO tasks')), true);
  assert.equal(calls.some((call) => call.sql.startsWith('INSERT INTO activity_events')), true);
  assert.equal(calls.some((call) => call.sql.startsWith('INSERT INTO audit_events')), true);
});


test('owner and agent use the same audited ticket edit operation', async () => {
  const { calls, service } = fixture();
  assert.deepEqual(await service.update('ticket-1', {
    title: 'Prioritise durable backup verification', priority: 8, blocker: 'awaiting isolated restore fixture',
    actualEffortMinutes: 30, verificationEvidence: 'unit test inspection',
  }, { type: 'agent', id: 'goofy' }), { id: 'ticket-1' });
  const update = calls.find((call) => call.sql.startsWith('UPDATE tasks'));
  assert.ok(update);
  assert.match(update.sql, /title=\$2,blocker=\$3,verification_evidence=\$4,priority=\$5,actual_effort_minutes=\$6/);
  assert.equal(calls.some((call) => call.sql.startsWith('INSERT INTO activity_events')), true);
  assert.equal(calls.some((call) => call.sql.startsWith('INSERT INTO audit_events')), true);
});
test('ticket service rejects unsupported board states before a database mutation', async () => {
  const { calls, service } = fixture();
  await assert.rejects(service.create({ title: 'invalid', status: 'waiting' as never }, { type: 'owner', id: 'owner' }), (error: unknown) => error instanceof TicketValidationError && error.reason === 'invalid_status');
  assert.equal(calls.length, 0);
});
