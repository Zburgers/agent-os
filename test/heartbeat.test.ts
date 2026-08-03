import test from 'node:test';
import assert from 'node:assert/strict';
import { writeHeartbeat } from '../src/heartbeat.ts';

test('heartbeat writes use a bounded query timeout so a broken database cannot leak pool clients', async () => {
  let request: unknown;
  const database = { async query(input: unknown) { request = input; return { rows: [] }; } };

  await writeHeartbeat(database, 'worker-1', 'running', { source: 'test' });

  assert.deepEqual(request, {
    text: expectSql(),
    values: ['worker-1', 'running', '{"source":"test"}'],
    query_timeout: 5000,
  });
});

function expectSql() {
  return `INSERT INTO supervisor_heartbeats(worker_id,status,detail) VALUES($1,$2,$3)
     ON CONFLICT(worker_id) DO UPDATE SET heartbeat_at=now(),status=EXCLUDED.status,detail=EXCLUDED.detail`;
}
