import test from 'node:test';
import assert from 'node:assert/strict';
import { bootstrapRevenueTracks } from '../scripts/bootstrap-revenue-tracks.mjs';

test('revenue track bootstrap is repeatable and reports deliberate unmapped records', async () => {
  const state = { roots: new Map<string, string>(), children: new Map<string, string>(), links: new Map<string, string>() };
  const calls: string[] = [];
  const database = {
    async query(sql: string, values: unknown[] = []) {
      calls.push(sql);
      if (sql === 'BEGIN' || sql === 'COMMIT' || sql === 'ROLLBACK') return { rows: [] };
      if (sql.startsWith('SELECT id FROM revenue_tracks WHERE parent_track_id IS NOT DISTINCT')) { const id = values[0] === null ? state.roots.get(String(values[1])) : state.children.get(`${values[0]}:${values[1]}`); return { rows: [id].filter(Boolean).map(value => ({ id: value })) }; }
      if (sql.startsWith('SELECT id,track_id FROM ventures')) return { rows: [{ id: 'venture-automation', track_id: state.links.get('venture-automation') ?? null }] };
      if (sql.startsWith('SELECT id,track_id FROM experiments')) return { rows: [{ id: 'experiment-bounty', track_id: state.links.get('experiment-bounty') ?? null }] };
      if (sql.startsWith('INSERT INTO revenue_tracks')) { const id = `track-${state.roots.size + state.children.size + 1}`; if (values[0] === null) state.roots.set(String(values[1]), id); else state.children.set(`${values[0]}:${values[1]}`, id); return { rows: [{ id }] }; }
      if (sql.includes("FROM ventures WHERE name='Automation Reliability Sprint'")) return { rows: [{ id: 'venture-automation', track_id: null }] };
      if (sql.includes('FROM experiments WHERE hypothesis=$1')) return { rows: [{ id: 'experiment-bounty', track_id: null }] };
      if (sql.startsWith('UPDATE ventures SET track_id')) { state.links.set(String(values[1]), String(values[0])); return { rows: [] }; }
      if (sql.startsWith('UPDATE experiments SET track_id')) { state.links.set(String(values[1]), String(values[0])); return { rows: [] }; }
      if (sql.startsWith('INSERT INTO audit_events')) return { rows: [] };
      throw new Error(`unexpected query: ${sql}`);
    },
  };
  const first = await bootstrapRevenueTracks(database as never);
  const second = await bootstrapRevenueTracks(database as never);
  assert.equal(first.created.length, 18);
  assert.deepEqual(second.created, []);
  assert.deepEqual(second.linked, { ventures: [], experiments: [] });
  assert.deepEqual(first.linked, { ventures: ['venture-automation'], experiments: ['experiment-bounty'] });
  assert.deepEqual(first.unlinked, { ventures: [], experiments: [] });
  assert.ok(calls.some(sql => sql.startsWith('INSERT INTO audit_events')));
});
