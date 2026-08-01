import test from 'node:test';
import assert from 'node:assert/strict';
import { RevenueTrackService, RevenueTrackValidationError } from '../src/revenue-tracks.ts';

function fixture() {
  const calls: Array<{ sql: string; values?: unknown[] }> = [];
  const client = {
    async query(sql: string, values: unknown[] = []) {
      calls.push({ sql, values });
      if (['BEGIN', 'COMMIT', 'ROLLBACK'].includes(sql)) return { rows: [], rowCount: 0 };
      if (sql.startsWith('INSERT INTO revenue_tracks')) return { rows: [{ id: 'track-1', name: values[0], status: values[3] ?? 'proposed' }], rowCount: 1 };
      if (sql.startsWith('UPDATE revenue_tracks')) return { rows: [{ id: values.at(-1) }] , rowCount: 1 };
      if (sql.startsWith('WITH RECURSIVE')) return { rows: [{ id: 'track-1', parent_track_id: null, name: 'Parent', status: 'active' }, { id: 'track-2', parent_track_id: 'track-1', name: 'Child', status: 'proposed' }] };
      if (sql.includes('FROM revenue_tracks rt')) return { rows: [{ id: 'track-1', name: 'Parent', child_count: '1', owner_handoff_count: '2', settled_revenue_minor: '5000', settled_expense_minor: '1200', settled_net_minor: '3800' }], rowCount: 1 };
      if (sql.startsWith('INSERT INTO audit_events')) return { rows: [], rowCount: 1 };
      throw new Error(`unexpected query: ${sql}`);
    },
    release() {},
  };
  return { calls, service: new RevenueTrackService({ connect: async () => client }) };
}

test('revenue track mutations are parameterized and audited with actor attribution', async () => {
  const { calls, service } = fixture();
  const created = await service.create({ name: 'Automation', ownerKind: 'agent', status: 'proposed', stage: 'discovery' }, { type: 'agent', id: 'goofy' });
  await service.update(created.id, { currentAction: 'Research buyers' }, { type: 'agent', id: 'goofy' });
  await service.reparent(created.id, null, { type: 'owner', id: 'owner' });
  await service.archive(created.id, 'killed', { type: 'owner', id: 'owner' });
  assert.equal(calls.filter((call) => call.sql.startsWith('INSERT INTO audit_events')).length, 4);
  assert.ok(calls.every((call) => !call.sql.includes('Automation')));
});

test('revenue track validation rejects unsupported status, owner, and stage before mutation', async () => {
  const { calls, service } = fixture();
  await assert.rejects(service.create({ name: 'Bad', status: 'running' as never }, { type: 'agent', id: 'goofy' }), (error: unknown) => error instanceof RevenueTrackValidationError);
  await assert.rejects(service.create({ name: 'Bad', ownerKind: 'system' as never }, { type: 'agent', id: 'goofy' }), (error: unknown) => error instanceof RevenueTrackValidationError);
  await assert.rejects(service.create({ name: 'Bad', stage: 'x'.repeat(81) }, { type: 'agent', id: 'goofy' }), (error: unknown) => error instanceof RevenueTrackValidationError);
  assert.equal(calls.length, 0);
});

test('revenue track tree and selected detail expose live aggregates and owner handoffs', async () => {
  const { service } = fixture();
  const tree = await service.listTree();
  assert.deepEqual(tree.map((track) => track.id), ['track-1', 'track-2']);
  const detail = await service.detail('track-1');
  assert.deepEqual(detail?.metrics, { childCount: 1, ownerHandoffCount: 2, settledRevenueMinor: 5000, settledExpenseMinor: 1200, settledNetMinor: 3800 });
});
