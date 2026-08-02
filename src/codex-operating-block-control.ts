import { randomUUID } from 'node:crypto';
import { pool } from './db.ts';

type Database = { query: (sql: string, values?: unknown[]) => Promise<{ rows: any[]; rowCount?: number }>; connect?: () => Promise<{ query: Database['query']; release: () => void }> };
export async function createManualCodexOccurrence(database: Database = pool) {
  if (database.connect) {
    const client = await database.connect();
    try {
      await client.query('BEGIN');
      const lock = await client.query("SELECT pg_try_advisory_xact_lock(hashtextextended('codex-operating-block', 0)) AS acquired");
      if (!lock.rows[0]?.acquired) { await client.query('ROLLBACK'); return { status: 'conflict' as const, error: 'already_running' }; }
      const key = `manual:${randomUUID()}`;
      const result = await client.query(`INSERT INTO codex_operating_block_occurrences(occurrence_key,intended_date,trigger_kind) VALUES($1,current_date,'manual') RETURNING id,occurrence_key`, [key]);
      await client.query('COMMIT');
      return { status: 'queued' as const, occurrenceId: result.rows[0].id, occurrenceKey: key };
    } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
  }
  const lock = await database.query("SELECT pg_try_advisory_xact_lock(hashtextextended('codex-operating-block', 0)) AS acquired");
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
    database.query("SELECT r.id,r.status,r.started_at,r.thread_id FROM codex_operating_block_runs r WHERE r.status='running' AND NOT EXISTS (SELECT 1 FROM codex_operating_block_run_events e WHERE e.run_id=r.id AND e.event_type IN ('completed','failed','cancelled','timeboxed')) ORDER BY r.started_at DESC LIMIT 1"),
    database.query("SELECT r.id,COALESCE(e.payload->>'status',r.status) AS status,e.payload->>'exit_reason' AS exit_reason,e.payload->>'summary' AS summary,e.payload->>'next_action' AS next_action,e.payload->>'git_before_sha' AS git_before_sha,e.payload->>'git_after_sha' AS git_after_sha,e.payload->'changed_files' AS changed_files,e.payload->'usage' AS usage FROM codex_operating_block_runs r LEFT JOIN LATERAL (SELECT payload FROM codex_operating_block_run_events WHERE run_id=r.id AND event_type='completed' ORDER BY occurred_at DESC LIMIT 1) e ON true ORDER BY r.started_at DESC LIMIT 1"),
  ]);
  const row = latest.rows[0];
  return { schedulePaused: Boolean(config.rows[0]?.schedule_paused), active: active.rows[0] ?? null, latest: row ? { ...row, statusLabel: summarizeCodexRun(row).statusLabel } : null };
}

export function summarizeCodexRun(run: any) {
  const statusLabel = run.status === 'timeboxed' ? 'Timeboxed at 58 minutes' : String(run.status ?? 'Unknown');
  const git = run.git_before_sha && run.git_after_sha ? `${run.git_before_sha} → ${run.git_after_sha}` : 'No Git change recorded';
  return { statusLabel, git, track: run.track ?? 'No track recorded', money: run.money ?? 'No settled money recorded', approvals: run.approvals ?? 'No approval summary recorded' };
}
