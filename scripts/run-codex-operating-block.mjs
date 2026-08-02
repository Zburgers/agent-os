import { chmod, mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { pool, controls, closeDatabase } from '../src/db.ts';
import { runCodexOperatingBlock, buildOperatingPrompt, CODEX_THREAD_ID, redactCodexText, validateCodexExecutable } from '../src/codex-operating-block.ts';

const executable = validateCodexExecutable(execFileSync('which', ['codex'], { encoding: 'utf8' }).trim());
const outputDirectory = process.env.CODEX_OUTPUT_DIRECTORY ?? '/home/goofy/.codex/operating-blocks';
await mkdir(outputDirectory, { recursive: true, mode: 0o700 });
await chmod(outputDirectory, 0o700);
const outputFile = join(outputDirectory, `${new Date().toISOString().replaceAll(':', '-')}-${CODEX_THREAD_ID}.final.txt`);
const eventFile = outputFile.replace(/\.final\.txt$/, '.events.jsonl');
const occurrenceKey = process.env.CODEX_OCCURRENCE_KEY ?? `scheduled:${new Date().toISOString().slice(0, 10)}`;
const lockClient = await pool.connect();
let transactionOpen = false;
let occurrenceId;
let runId;
try {
await lockClient.query('BEGIN');
transactionOpen = true;
const lock = await lockClient.query('SELECT pg_try_advisory_xact_lock(hashtextextended($1, 0)) AS acquired', ['codex-operating-block']);
if (!lock.rows[0]?.acquired) { await lockClient.query('ROLLBACK'); transactionOpen = false; lockClient.release(); console.log(JSON.stringify({ status: 'skipped', exitReason: 'lock_collision', threadId: CODEX_THREAD_ID })); await closeDatabase(); process.exit(0); }
const occurrence = await pool.query(`INSERT INTO codex_operating_block_occurrences(occurrence_key,intended_date,trigger_kind) VALUES($1,current_date,$2) ON CONFLICT(occurrence_key) DO UPDATE SET occurrence_key=EXCLUDED.occurrence_key RETURNING id,status`, [occurrenceKey, process.env.CODEX_TRIGGER_KIND === 'manual' ? 'manual' : 'scheduled']);
occurrenceId = occurrence.rows[0].id;
if (occurrence.rows[0].status !== 'queued') { await lockClient.query('COMMIT'); transactionOpen = false; lockClient.release(); console.log(JSON.stringify({ status: 'skipped', exitReason: 'duplicate_occurrence', threadId: CODEX_THREAD_ID })); await closeDatabase(); process.exit(0); }
const occurrenceMeta = await pool.query('SELECT trigger_kind FROM codex_operating_block_occurrences WHERE id=$1', [occurrenceId]);
const paused = await pool.query('SELECT schedule_paused FROM codex_operating_block_config WHERE singleton=true');
if (occurrenceMeta.rows[0]?.trigger_kind === 'scheduled' && paused.rows[0]?.schedule_paused) {
  await pool.query('UPDATE codex_operating_block_occurrences SET status=$1,finished_at=now() WHERE id=$2', ['skipped', occurrenceId]);
  await lockClient.query('COMMIT'); transactionOpen = false; lockClient.release();
  console.log(JSON.stringify({ status: 'skipped', exitReason: 'schedule_paused', threadId: CODEX_THREAD_ID })); await closeDatabase(); process.exit(0);
}
await pool.query('UPDATE codex_operating_block_occurrences SET status=$1,started_at=now() WHERE id=$2', ['running', occurrenceId]);
const run = await pool.query('INSERT INTO codex_operating_block_runs(occurrence_id,thread_id,status,started_at) VALUES($1,$2,\'running\',now()) RETURNING id,started_at', [occurrenceId, CODEX_THREAD_ID]);
runId = run.rows[0].id;
await pool.query('INSERT INTO codex_operating_block_run_events(run_id,event_type,payload) VALUES($1,\'started\',$2)', [runId, JSON.stringify({ thread_id: CODEX_THREAD_ID, occurrence_id: occurrenceId })]);
const result = await runCodexOperatingBlock({ executable, outputFile, prompt: buildOperatingPrompt(), control: controls, onOutput: (text) => process.stderr.write(text) });
await chmod(outputFile, 0o600);
await writeFile(eventFile, result.output, { mode: 0o600 });
const checksum = createHash('sha256').update(result.output).digest('hex');
const terminal = { status: result.status, exit_reason: result.exitReason, thread_id: result.threadId, log_path: eventFile, final_output_path: outputFile, log_checksum: checksum, summary: result.output.slice(-20000), next_action: 'Review persisted run evidence', error: result.error ?? null };
await pool.query('INSERT INTO codex_operating_block_run_events(run_id,event_type,payload) VALUES($1,\'completed\',$2)', [runId, JSON.stringify(terminal)]);
await pool.query('UPDATE codex_operating_block_occurrences SET status=$1,finished_at=now() WHERE id=$2', [result.status, occurrenceId]);
console.log(JSON.stringify({ ...result, output: undefined, outputFile, eventFile, runId }));
await lockClient.query('COMMIT');
transactionOpen = false;
lockClient.release();
await closeDatabase();
} catch (error) {
  const message = redactCodexText(error instanceof Error ? error.message : String(error));
  if (runId) {
    try { await pool.query("INSERT INTO codex_operating_block_run_events(run_id,event_type,payload) VALUES($1,'failed',$2)", [runId, JSON.stringify({ status: 'failed', exit_reason: 'runner_exception', error: message })]); } catch {}
  }
  if (occurrenceId) {
    try { await pool.query("UPDATE codex_operating_block_occurrences SET status='failed',finished_at=now() WHERE id=$1 AND status='running'", [occurrenceId]); } catch {}
  }
  if (transactionOpen) { try { await lockClient.query('ROLLBACK'); } catch {} }
  try { lockClient.release(); } catch {}
  try { await closeDatabase(); } catch {}
  throw error;
}
