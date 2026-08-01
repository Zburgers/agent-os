import test from 'node:test';
import assert from 'node:assert/strict';
import { createManualCodexOccurrence, setCodexSchedulePaused, summarizeCodexRun } from '../src/codex-operating-block-control.ts';

test('Codex control creates one manual occurrence and reports collision without starting a process', async () => {
  const calls: string[] = [];
  const db = { query: async (sql: string) => { calls.push(sql); if (sql.includes('pg_try_advisory_lock')) return { rows: [{ acquired: false }] }; return { rows: [] }; } };
  const result = await createManualCodexOccurrence(db as never);
  assert.deepEqual(result, { status: 'conflict', error: 'already_running' });
  assert.equal(calls.filter((sql) => sql.includes('INSERT INTO codex_operating_block_occurrences')).length, 0);
});

test('Codex schedule pause is owner-controlled and run summaries expose timeout and bounded evidence', async () => {
  const calls: Array<{ sql: string; values: unknown[] }> = [];
  const db = { query: async (sql: string, values: unknown[] = []) => { calls.push({ sql, values }); return { rows: [{ schedule_paused: true }] }; } };
  assert.deepEqual(await setCodexSchedulePaused(db as never, true), { schedulePaused: true });
  const summary = summarizeCodexRun({ status: 'timeboxed', exit_reason: 'graceful_timeout', git_before_sha: 'a', git_after_sha: 'b', summary: 'bounded result', next_action: 'review', changed_files: [], usage: {} });
  assert.equal(summary.statusLabel, 'Timeboxed at 58 minutes');
  assert.equal(summary.git, 'a → b');
  assert.equal(calls.length, 1);
});
