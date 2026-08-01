import { chmod, mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { pool, controls, closeDatabase } from '../src/db.ts';
import { runCodexOperatingBlock, buildOperatingPrompt, CODEX_THREAD_ID, validateCodexExecutable } from '../src/codex-operating-block.ts';

const executable = validateCodexExecutable(execFileSync('which', ['codex'], { encoding: 'utf8' }).trim());
const outputDirectory = process.env.CODEX_OUTPUT_DIRECTORY ?? '/home/goofy/.codex/operating-blocks';
await mkdir(outputDirectory, { recursive: true, mode: 0o700 });
await chmod(outputDirectory, 0o700);
const outputFile = join(outputDirectory, `${new Date().toISOString().replaceAll(':', '-')}-${CODEX_THREAD_ID}.jsonl`);
const occurrenceKey = process.env.CODEX_OCCURRENCE_KEY ?? `scheduled:${new Date().toISOString().slice(0, 10)}`;
const lock = await pool.query<{ acquired: boolean }>('SELECT pg_try_advisory_lock(hashtextextended($1, 0)) AS acquired', ['codex-operating-block']);
if (!lock.rows[0]?.acquired) { console.log(JSON.stringify({ status: 'skipped', exitReason: 'lock_collision', threadId: CODEX_THREAD_ID })); await closeDatabase(); process.exit(0); }
const occurrence = await pool.query<{ id: string; status: string }>(`INSERT INTO codex_operating_block_occurrences(occurrence_key,intended_date,trigger_kind) VALUES($1,current_date,$2) ON CONFLICT(occurrence_key) DO UPDATE SET occurrence_key=EXCLUDED.occurrence_key RETURNING id,status`, [occurrenceKey, process.env.CODEX_TRIGGER_KIND === 'manual' ? 'manual' : 'scheduled']);
const occurrenceId = occurrence.rows[0].id;
if (occurrence.rows[0].status !== 'queued') { console.log(JSON.stringify({ status: 'skipped', exitReason: 'duplicate_occurrence', threadId: CODEX_THREAD_ID })); await closeDatabase(); process.exit(0); }
await pool.query('UPDATE codex_operating_block_occurrences SET status=$1,started_at=now() WHERE id=$2', ['running', occurrenceId]);
const result = await runCodexOperatingBlock({ executable, outputFile, prompt: buildOperatingPrompt(), control: controls, onOutput: (text) => process.stderr.write(text) });
await writeFile(outputFile, result.output, { mode: 0o600 });
const checksum = createHash('sha256').update(result.output).digest('hex');
await pool.query('INSERT INTO codex_operating_block_runs(occurrence_id,thread_id,status,exit_reason,finished_at,duration_ms,log_path,log_checksum,last_assistant_message,next_action,error) VALUES($1,$2,$3,$4,now(),0,$5,$6,$7,$8,$9)', [occurrenceId, result.threadId, result.status, result.exitReason, outputFile, checksum, result.output.slice(-20000), 'Review persisted run evidence', result.error ?? null]);
await pool.query('UPDATE codex_operating_block_occurrences SET status=$1,finished_at=now() WHERE id=$2', [result.status, occurrenceId]);
await pool.query('SELECT pg_advisory_unlock(hashtextextended($1, 0))', ['codex-operating-block']);
console.log(JSON.stringify({ ...result, output: undefined, outputFile }));
await closeDatabase();
