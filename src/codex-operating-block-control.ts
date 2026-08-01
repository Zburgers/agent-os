import { randomUUID } from 'node:crypto';
import { pool } from './db.ts';

type Database = { query: (sql: string, values?: unknown[]) => Promise<{ rows: any[]; rowCount?: number }> };
export async function createManualCodexOccurrence(database: Database = pool) {
  const lock = await database.query("SELECT pg_try_advisory_lock(hashtextextended('codex-operating-block', 0)) AS acquired");
  if (!lock.rows[0]?.acquired) return { status: 'conflict' as const, error: 'already_running' };
  const key = `manual:${randomUUID()}`;
  const result = await database.query(`INSERT INTO codex_operating_block_occurrences(occurrence_key,intended_date,trigger_kind) VALUES($1,current_date,'manual') RETURNING id,occurrence_key`, [key]);
  return { status: 'queued' as const, occurrenceId: result.rows[0].id, occurrenceKey: key };
}

export async function setCodexSchedulePaused(database: Database = pool, paused: boolean) {
  const result = await database.query('UPDATE codex_operating_block_config SET schedule_paused=$1,updated_at=now() WHERE singleton=true RETURNING schedule_paused', [paused]);
  return { schedulePaused: Boolean(result.rows[0]?.schedule_paused) };
}

export async function codexOperatingBlockSnapshot(database: Database = pool) {
  const [config, active, latest] = await Promise.all([
    database.query('SELECT schedule_paused FROM codex_operating_block_config WHERE singleton=true'),
    database.query("SELECT id,status,started_at,thread_id FROM codex_operating_block_runs WHERE status='running' ORDER BY started_at DESC LIMIT 1"),
    database.query('SELECT id,status,exit_reason,summary,next_action,git_before_sha,git_after_sha,changed_files,usage FROM codex_operating_block_runs ORDER BY started_at DESC LIMIT 1'),
  ]);
  const row = latest.rows[0];
  return { schedulePaused: Boolean(config.rows[0]?.schedule_paused), active: active.rows[0] ?? null, latest: row ? { ...row, statusLabel: summarizeCodexRun(row).statusLabel } : null };
}

export function summarizeCodexRun(run: any) {
  const statusLabel = run.status === 'timeboxed' ? 'Timeboxed at 58 minutes' : String(run.status ?? 'Unknown');
  const git = run.git_before_sha && run.git_after_sha ? `${run.git_before_sha} → ${run.git_after_sha}` : 'No Git change recorded';
  return { statusLabel, git, track: run.track ?? 'No track recorded', money: run.money ?? 'No settled money recorded', approvals: run.approvals ?? 'No approval summary recorded' };
}
