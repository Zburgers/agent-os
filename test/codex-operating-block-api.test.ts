import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { readFile } from 'node:fs/promises';
import {
  CODEX_OPERATING_BLOCK_LOCK_KEY,
  codexOperatingBlockSnapshot,
  createManualCodexOccurrence,
  launchManualCodexOccurrence,
  markCodexOccurrenceLaunchFailed,
  markManualCodexOccurrenceLockCollision,
  recoverAbandonedCodexOccurrences,
  setCodexSchedulePaused,
  summarizeCodexRun,
} from '../src/codex-operating-block-control.ts';

type QueryCall = { sql: string; values: unknown[] };

function transactionalDatabase(options: { outstanding?: { id: string; occurrence_key: string; status: string } | null } = {}) {
  const calls: QueryCall[] = [];
  const inserted: Array<{ id: string; occurrence_key: string; status: string }> = [];
  let lockHeld = false;
  let sequence = 0;
  return {
    calls,
    inserted,
    database: {
      async connect() {
        let ownsLock = false;
        return {
          async query(sql: string, values: unknown[] = []) {
            calls.push({ sql, values });
            await new Promise<void>((resolve) => setImmediate(resolve));
            if (sql === 'BEGIN') return { rows: [] };
            if (sql.includes('pg_try_advisory_xact_lock')) {
              if (lockHeld) return { rows: [{ acquired: false }] };
              lockHeld = true;
              ownsLock = true;
              return { rows: [{ acquired: true }] };
            }
            if (sql.includes('codex_occurrence_recovered')) return { rows: [] };
            if (sql.includes('FROM codex_operating_block_occurrences occurrence')) {
              if (options.outstanding) return { rows: [options.outstanding] };
              return { rows: inserted.filter((row) => row.status === 'queued').slice(0, 1) };
            }
            if (sql.includes('INSERT INTO codex_operating_block_occurrences')) {
              sequence += 1;
              const row = { id: `occurrence-${sequence}`, occurrence_key: String(values[0]), status: 'queued' };
              inserted.push(row);
              return { rows: [row] };
            }
            if (sql === 'COMMIT' || sql === 'ROLLBACK') {
              if (ownsLock) lockHeld = false;
              ownsLock = false;
              return { rows: [] };
            }
            throw new Error(`Unexpected SQL: ${sql}`);
          },
          release() {},
        };
      },
      async query() { throw new Error('transaction client required'); },
    },
  };
}

test('existing queued Codex occurrence returns conflict and performs no insert', async () => {
  const fake = transactionalDatabase({ outstanding: { id: 'queued-1', occurrence_key: 'manual:queued', status: 'queued' } });
  const result = await createManualCodexOccurrence(fake.database as never);
  assert.deepEqual(result, { status: 'conflict', error: 'already_queued_or_running' });
  assert.equal(fake.calls.some(({ sql }) => sql.includes('INSERT INTO codex_operating_block_occurrences')), false);
});

test('effective active Codex run returns conflict', async () => {
  const fake = transactionalDatabase({ outstanding: { id: 'running-1', occurrence_key: 'manual:running', status: 'running' } });
  const result = await createManualCodexOccurrence(fake.database as never);
  assert.deepEqual(result, { status: 'conflict', error: 'already_queued_or_running' });
  const outstandingSql = fake.calls.find(({ sql }) => sql.includes('FROM codex_operating_block_occurrences occurrence'))?.sql ?? '';
  assert.match(outstandingSql, /occurrence\.status = 'running'/);
  assert.match(outstandingSql, /NOT EXISTS[\s\S]*event_type IN \('completed','failed','cancelled','timeboxed'\)/);
});

test('two concurrent manual creates produce exactly one queued occurrence', async () => {
  const fake = transactionalDatabase();
  const results = await Promise.all([
    createManualCodexOccurrence(fake.database as never),
    createManualCodexOccurrence(fake.database as never),
  ]);
  assert.equal(results.filter((result) => result.status === 'queued').length, 1);
  assert.equal(results.filter((result) => result.status === 'conflict').length, 1);
  assert.equal(fake.inserted.length, 1);
});

test('stale queued occurrences are recovered before a new manual insert', async () => {
  const fake = transactionalDatabase();
  const result = await createManualCodexOccurrence(fake.database as never);
  assert.equal(result.status, 'queued');
  const recoveryIndex = fake.calls.findIndex(({ sql }) => sql.includes('codex_occurrence_recovered'));
  const insertIndex = fake.calls.findIndex(({ sql }) => sql.includes('INSERT INTO codex_operating_block_occurrences'));
  assert.ok(recoveryIndex >= 0 && recoveryIndex < insertIndex);
  assert.match(fake.calls[recoveryIndex].sql, /interval '5 minutes'/);
});

test('spawn error terminalizes a queued occurrence with only redacted audit evidence', async () => {
  const calls: QueryCall[] = [];
  let persisted!: () => void;
  const persistedPromise = new Promise<void>((resolve) => { persisted = resolve; });
  const database = {
    async query(sql: string, values: unknown[] = []) {
      calls.push({ sql, values });
      persisted();
      return { rows: [{ entity_id: 'occurrence-1' }] };
    },
  };
  const child = new EventEmitter() as EventEmitter & { unref(): void };
  let unrefCalled = false;
  child.unref = () => { unrefCalled = true; };
  await launchManualCodexOccurrence({
    database,
    occurrence: { occurrenceId: 'occurrence-1', occurrenceKey: 'manual:one' },
    runner: '/tmp/runner.mjs',
    cwd: '/tmp',
    spawn: (() => {
      setImmediate(() => {
        const error = new Error('token=super-secret api_key=hidden');
        error.name = 'SpawnError';
        child.emit('error', error);
      });
      return child as never;
    }) as never,
  });
  assert.equal(unrefCalled, true);
  await persistedPromise;
  assert.equal(calls.length, 1);
  assert.match(calls[0].sql, /SET status='failed', finished_at=now\(\)/);
  assert.match(calls[0].sql, /WHERE id=\$1 AND status='queued'/);
  assert.deepEqual(calls[0].values, ['occurrence-1', 'SpawnError', 'token=[REDACTED] api_key=[REDACTED]']);
  assert.doesNotMatch(JSON.stringify(calls[0]), /super-secret|hidden|CODEX_OCCURRENCE_KEY|process\.env/);
});

test('synchronous spawn failure is persisted before it is rethrown', async () => {
  const calls: QueryCall[] = [];
  await assert.rejects(
    launchManualCodexOccurrence({
      database: { async query(sql: string, values: unknown[] = []) { calls.push({ sql, values }); return { rows: [{ entity_id: 'occurrence-sync' }] }; } },
      occurrence: { occurrenceId: 'occurrence-sync', occurrenceKey: 'manual:sync' },
      spawn: (() => { throw new Error('password: launch-secret'); }) as never,
    }),
    /launch-secret/,
  );
  assert.equal(calls.length, 1);
  assert.equal(calls[0].values[2], 'password=[REDACTED]');
});

test('successful spawn leaves the occurrence queued for the runner to claim', async () => {
  let queried = false;
  let unrefCalled = false;
  const child = new EventEmitter() as EventEmitter & { unref(): void };
  child.unref = () => { unrefCalled = true; };
  const result = await launchManualCodexOccurrence({
    database: { async query() { queried = true; return { rows: [] }; } },
    occurrence: { occurrenceId: 'occurrence-success', occurrenceKey: 'manual:success' },
    spawn: (() => child as never) as never,
  });
  assert.deepEqual(result, { launched: true });
  assert.equal(unrefCalled, true);
  assert.equal(queried, false);
});

test('lock collision skips the corresponding queued manual occurrence and audits it', async () => {
  const calls: QueryCall[] = [];
  const result = await markManualCodexOccurrenceLockCollision({
    async query(sql: string, values: unknown[] = []) {
      calls.push({ sql, values });
      return { rows: [{ entity_id: 'occurrence-collision' }] };
    },
  }, 'manual:collision');
  assert.deepEqual(result, { marked: true });
  assert.match(calls[0].sql, /SET status='skipped', finished_at=now\(\)/);
  assert.match(calls[0].sql, /trigger_kind='manual' AND status='queued'/);
  assert.match(calls[0].sql, /'exit_reason','lock_collision'/);
  assert.deepEqual(calls[0].values, ['manual:collision']);
});

test('recovery and launch failure helpers do not audit when no queued row transitions', async () => {
  const database = { async query() { return { rows: [] }; } };
  assert.deepEqual(await recoverAbandonedCodexOccurrences(database), { recovered: 0 });
  assert.deepEqual(await markCodexOccurrenceLaunchFailed(database, 'missing', new Error('missing')), { marked: false });
});

test('scheduled and manual paths use the same single-run lock key', async () => {
  const fake = transactionalDatabase();
  await createManualCodexOccurrence(fake.database as never);
  const lockCall = fake.calls.find(({ sql }) => sql.includes('pg_try_advisory_xact_lock'));
  assert.deepEqual(lockCall?.values, [CODEX_OPERATING_BLOCK_LOCK_KEY]);
  const runner = await readFile(new URL('../scripts/run-codex-operating-block.mjs', import.meta.url), 'utf8');
  assert.match(runner, /CODEX_OPERATING_BLOCK_LOCK_KEY/);
  assert.match(runner, /pg_try_advisory_xact_lock\(hashtextextended\(\$1, 0\)\)[\s\S]*\[CODEX_OPERATING_BLOCK_LOCK_KEY\]/);
});

test('Codex schedule pause is owner-controlled and run summaries expose timeout and bounded evidence', async () => {
  const calls: QueryCall[] = [];
  const db = { query: async (sql: string, values: unknown[] = []) => { calls.push({ sql, values }); return { rows: [{ schedule_paused: true }] }; } };
  assert.deepEqual(await setCodexSchedulePaused(db, true), { schedulePaused: true });
  const summary = summarizeCodexRun({ status: 'timeboxed', exit_reason: 'graceful_timeout', git_before_sha: 'a', git_after_sha: 'b', summary: 'bounded result', next_action: 'review', changed_files: [], usage: {} });
  assert.equal(summary.statusLabel, 'Timeboxed at 58 minutes');
  assert.equal(summary.git, 'a → b');
  assert.equal(calls.length, 1);
});

test('Codex active-run query derives completion from terminal events', async () => {
  const calls: string[] = [];
  const db = { query: async (sql: string) => { calls.push(sql); return { rows: [] }; } };
  await codexOperatingBlockSnapshot(db);
  assert.match(calls[1], /NOT EXISTS[\s\S]*codex_operating_block_run_events/);
});

const postgresEnabled = process.env.RUN_POSTGRES_INTEGRATION === 'true';

test('manual Codex occurrence lifecycle is durable in PostgreSQL', { skip: !postgresEnabled }, async () => {
  const { pool } = await import('../src/db.ts');
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;

  await pool.query(
    "UPDATE codex_operating_block_occurrences SET status='failed',finished_at=now() WHERE status='queued'",
  );

  const stale = await pool.query<{ id: string }>(
    `INSERT INTO codex_operating_block_occurrences(occurrence_key,intended_date,trigger_kind,status,created_at)
     VALUES($1,current_date,'manual','queued',now()-interval '6 minutes') RETURNING id`,
    [`integration-codex-stale-${suffix}`],
  );
  const recovered = await createManualCodexOccurrence(pool);
  assert.equal(recovered.status, 'queued');
  assert.equal(
    (await pool.query('SELECT status FROM codex_operating_block_occurrences WHERE id=$1', [stale.rows[0].id])).rows[0].status,
    'failed',
  );
  assert.equal(
    (await pool.query(
      "SELECT count(*) FROM audit_events WHERE event_type='codex_occurrence_recovered' AND entity_id=$1",
      [stale.rows[0].id],
    )).rows[0].count,
    '1',
  );

  if (recovered.status === 'queued') {
    await markCodexOccurrenceLaunchFailed(pool, recovered.occurrenceId, new Error('token=integration-secret'));
    const failed = (await pool.query(
      'SELECT status FROM codex_operating_block_occurrences WHERE id=$1',
      [recovered.occurrenceId],
    )).rows[0];
    assert.equal(failed.status, 'failed');
    const launchAudit = (await pool.query(
      `SELECT payload FROM audit_events
       WHERE event_type='codex_occurrence_launch_failed' AND entity_id=$1`,
      [recovered.occurrenceId],
    )).rows[0];
    assert.deepEqual(launchAudit.payload, {
      occurrence_id: recovered.occurrenceId,
      exit_reason: 'spawn_error',
      error_class: 'Error',
      error_message: 'token=[REDACTED]',
    });
  }

  const concurrent = await Promise.all([
    createManualCodexOccurrence(pool),
    createManualCodexOccurrence(pool),
  ]);
  assert.equal(concurrent.filter((result) => result.status === 'queued').length, 1);
  assert.equal(concurrent.filter((result) => result.status === 'conflict').length, 1);
  const queued = concurrent.find((result) => result.status === 'queued');
  assert.ok(queued && queued.status === 'queued');
  if (queued?.status === 'queued') {
    await markManualCodexOccurrenceLockCollision(pool, queued.occurrenceKey);
    assert.equal(
      (await pool.query('SELECT status FROM codex_operating_block_occurrences WHERE id=$1', [queued.occurrenceId])).rows[0].status,
      'skipped',
    );
    assert.equal(
      (await pool.query(
        "SELECT count(*) FROM audit_events WHERE event_type='codex_occurrence_lock_collision' AND entity_id=$1",
        [queued.occurrenceId],
      )).rows[0].count,
      '1',
    );
  }

  const activeOccurrence = await pool.query<{ id: string }>(
    `INSERT INTO codex_operating_block_occurrences(occurrence_key,intended_date,trigger_kind,status,started_at)
     VALUES($1,current_date,'scheduled','running',now()) RETURNING id`,
    [`integration-codex-active-${suffix}`],
  );
  const activeRun = await pool.query<{ id: string }>(
    `INSERT INTO codex_operating_block_runs(occurrence_id,thread_id,status,started_at)
     VALUES($1,'019faa3e-b7af-7e13-8335-4f651c989e27','running',now()) RETURNING id`,
    [activeOccurrence.rows[0].id],
  );
  assert.deepEqual(await createManualCodexOccurrence(pool), {
    status: 'conflict',
    error: 'already_queued_or_running',
  });

  await pool.query(
    "INSERT INTO codex_operating_block_run_events(run_id,event_type,payload) VALUES($1,'completed','{}')",
    [activeRun.rows[0].id],
  );
  const afterTerminal = await createManualCodexOccurrence(pool);
  assert.equal(afterTerminal.status, 'queued');
  if (afterTerminal.status === 'queued') {
    await markManualCodexOccurrenceLockCollision(pool, afterTerminal.occurrenceKey);
  }
  await pool.query(
    "UPDATE codex_operating_block_occurrences SET status='completed',finished_at=now() WHERE id=$1",
    [activeOccurrence.rows[0].id],
  );
});
