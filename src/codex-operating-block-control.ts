import { randomUUID } from 'node:crypto';
import { spawn as nodeSpawn, type ChildProcess } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { pool } from './db.ts';
import { CODEX_WORKING_DIRECTORY, redactCodexText } from './codex-operating-block.ts';

// Manual admission and scheduled execution must contend on this exact key.
export const CODEX_OPERATING_BLOCK_LOCK_KEY = 'codex-operating-block';
const ABANDONED_QUEUE_INTERVAL = '5 minutes';
const TERMINAL_EVENT_TYPES = "'completed','failed','cancelled','timeboxed'";

type QueryResult = { rows: any[]; rowCount?: number };
export type CodexDatabaseQuery = (sql: string, values?: unknown[]) => Promise<QueryResult>;
export type CodexQueryable = { query: CodexDatabaseQuery };
type CodexTransactionClient = CodexQueryable & { release: () => void };
type CodexDatabase = CodexQueryable & { connect: () => Promise<CodexTransactionClient> };
type SpawnChild = Pick<ChildProcess, 'once' | 'unref'>;
type Spawn = (command: string, args: readonly string[], options: Record<string, unknown>) => SpawnChild;
export type ManualCodexOccurrence = { occurrenceId: string; occurrenceKey: string };

function sanitizedSpawnError(error: unknown) {
  const rawClass = error instanceof Error ? error.name : (error as { constructor?: { name?: string } } | null)?.constructor?.name ?? typeof error;
  const errorClass = String(rawClass).replace(/[^A-Za-z0-9_.-]/g, '_').slice(0, 80) || 'Error';
  const rawMessage = error instanceof Error ? error.message : String(error);
  const errorMessage = redactCodexText(rawMessage).replace(/\s+/g, ' ').trim().slice(0, 500) || 'spawn failed';
  return { errorClass, errorMessage };
}

export async function recoverAbandonedCodexOccurrences(database: CodexQueryable) {
  const recovered = await database.query(
    `WITH recovered AS (
       UPDATE codex_operating_block_occurrences
       SET status='failed', finished_at=now()
       WHERE status='queued'
         AND created_at < now() - interval '${ABANDONED_QUEUE_INTERVAL}'
       RETURNING id
     )
     INSERT INTO audit_events(actor_type,actor_id,event_type,entity_type,entity_id,payload)
     SELECT 'agent','system','codex_occurrence_recovered','codex_operating_block_occurrence',id::text,
            jsonb_build_object('occurrence_id',id,'exit_reason','stale_queued_timeout')
     FROM recovered
     RETURNING entity_id`,
  );
  return { recovered: recovered.rows.length };
}

export async function markCodexOccurrenceLaunchFailed(database: CodexQueryable, occurrenceId: string, error: unknown) {
  const sanitized = sanitizedSpawnError(error);
  const result = await database.query(
    `WITH failed AS (
       UPDATE codex_operating_block_occurrences
       SET status='failed', finished_at=now()
       WHERE id=$1 AND status='queued'
       RETURNING id
     )
     INSERT INTO audit_events(actor_type,actor_id,event_type,entity_type,entity_id,payload)
     SELECT 'agent','system','codex_occurrence_launch_failed','codex_operating_block_occurrence',id::text,
            jsonb_build_object(
              'occurrence_id',id,
              'exit_reason','spawn_error',
              'error_class',$2::text,
              'error_message',$3::text
            )
     FROM failed
     RETURNING entity_id`,
    [occurrenceId, sanitized.errorClass, sanitized.errorMessage],
  );
  return { marked: result.rows.length === 1 };
}

export async function markManualCodexOccurrenceLockCollision(database: CodexQueryable, occurrenceKey: string) {
  const result = await database.query(
    `WITH skipped AS (
       UPDATE codex_operating_block_occurrences
       SET status='skipped', finished_at=now()
       WHERE occurrence_key=$1 AND trigger_kind='manual' AND status='queued'
       RETURNING id
     )
     INSERT INTO audit_events(actor_type,actor_id,event_type,entity_type,entity_id,payload)
     SELECT 'agent','system','codex_occurrence_lock_collision','codex_operating_block_occurrence',id::text,
            jsonb_build_object('occurrence_id',id,'exit_reason','lock_collision')
     FROM skipped
     RETURNING entity_id`,
    [occurrenceKey],
  );
  return { marked: result.rows.length === 1 };
}

export async function createManualCodexOccurrence(database: CodexDatabase = pool) {
  const client = await database.connect();
  let transactionOpen = false;
  try {
    await client.query('BEGIN');
    transactionOpen = true;
    const lock = await client.query(
      'SELECT pg_try_advisory_xact_lock(hashtextextended($1, 0)) AS acquired',
      [CODEX_OPERATING_BLOCK_LOCK_KEY],
    );
    if (!lock.rows[0]?.acquired) {
      await client.query('ROLLBACK');
      transactionOpen = false;
      return { status: 'conflict' as const, error: 'already_queued_or_running' as const };
    }

    await recoverAbandonedCodexOccurrences(client);
    const outstanding = await client.query(
      `SELECT id, occurrence_key, status
       FROM codex_operating_block_occurrences occurrence
       WHERE occurrence.status = 'queued'
          OR (
            occurrence.status = 'running'
            AND EXISTS (
              SELECT 1
              FROM codex_operating_block_runs run
              WHERE run.occurrence_id = occurrence.id
                AND NOT EXISTS (
                  SELECT 1
                  FROM codex_operating_block_run_events event
                  WHERE event.run_id = run.id
                    AND event.event_type IN (${TERMINAL_EVENT_TYPES})
                )
            )
          )
       LIMIT 1`,
    );
    if (outstanding.rows[0]) {
      await client.query('ROLLBACK');
      transactionOpen = false;
      return { status: 'conflict' as const, error: 'already_queued_or_running' as const };
    }

    const occurrenceKey = `manual:${randomUUID()}`;
    const inserted = await client.query(
      `INSERT INTO codex_operating_block_occurrences(occurrence_key,intended_date,trigger_kind)
       VALUES($1,current_date,'manual')
       RETURNING id,occurrence_key`,
      [occurrenceKey],
    );
    await client.query('COMMIT');
    transactionOpen = false;
    return {
      status: 'queued' as const,
      occurrenceId: inserted.rows[0].id as string,
      occurrenceKey: inserted.rows[0].occurrence_key as string,
    };
  } catch (error) {
    if (transactionOpen) {
      try { await client.query('ROLLBACK'); } catch {}
    }
    throw error;
  } finally {
    client.release();
  }
}

export async function launchManualCodexOccurrence(options: {
  database: CodexQueryable;
  occurrence: ManualCodexOccurrence;
  spawn?: Spawn;
  runner?: string;
  cwd?: string;
}) {
  const spawn = options.spawn ?? (nodeSpawn as unknown as Spawn);
  const runner = options.runner ?? fileURLToPath(new URL('../scripts/run-codex-operating-block.mjs', import.meta.url));
  let child: SpawnChild;
  try {
    child = spawn(process.execPath, [runner], {
      cwd: options.cwd ?? CODEX_WORKING_DIRECTORY,
      detached: true,
      stdio: 'ignore',
      env: {
        ...process.env,
        CODEX_OCCURRENCE_KEY: options.occurrence.occurrenceKey,
        CODEX_TRIGGER_KIND: 'manual',
      },
    });
  } catch (error) {
    await markCodexOccurrenceLaunchFailed(options.database, options.occurrence.occurrenceId, error);
    throw error;
  }
  child.once('error', (error) => {
    void markCodexOccurrenceLaunchFailed(options.database, options.occurrence.occurrenceId, error).catch(() => undefined);
  });
  child.unref();
  return { launched: true as const };
}

export async function setCodexSchedulePaused(database: CodexQueryable = pool, paused: boolean) {
  const result = await database.query('UPDATE codex_operating_block_config SET schedule_paused=$1,updated_at=now() WHERE singleton=true RETURNING schedule_paused', [paused]);
  return { schedulePaused: Boolean(result.rows[0]?.schedule_paused) };
}

export async function codexOperatingBlockSnapshot(database: CodexQueryable = pool) {
  const [config, active, latest] = await Promise.all([
    database.query('SELECT schedule_paused FROM codex_operating_block_config WHERE singleton=true'),
    database.query("SELECT r.id,r.status,r.started_at,r.thread_id FROM codex_operating_block_runs r WHERE r.status='running' AND NOT EXISTS (SELECT 1 FROM codex_operating_block_run_events e WHERE e.run_id=r.id AND e.event_type IN ('completed','failed','cancelled','timeboxed')) ORDER BY r.started_at DESC LIMIT 1"),
    database.query("SELECT r.id,COALESCE(e.payload->>'status',r.status) AS status,e.payload->>'exit_reason' AS exit_reason,e.payload->>'summary' AS summary,e.payload->>'next_action' AS next_action,e.payload->>'git_before_sha' AS git_before_sha,e.payload->>'git_after_sha' AS git_after_sha,e.payload->'changed_files' AS changed_files,e.payload->'usage' AS usage FROM codex_operating_block_runs r LEFT JOIN LATERAL (SELECT payload FROM codex_operating_block_run_events WHERE run_id=r.id AND event_type IN ('completed','failed','cancelled','timeboxed') ORDER BY occurred_at DESC LIMIT 1) e ON true ORDER BY r.started_at DESC LIMIT 1"),
  ]);
  const row = latest.rows[0];
  return { schedulePaused: Boolean(config.rows[0]?.schedule_paused), active: active.rows[0] ?? null, latest: row ? { ...row, statusLabel: summarizeCodexRun(row).statusLabel } : null };
}

export function summarizeCodexRun(run: any) {
  const statusLabel = run.status === 'timeboxed' ? 'Timeboxed at 58 minutes' : String(run.status ?? 'Unknown');
  const git = run.git_before_sha && run.git_after_sha ? `${run.git_before_sha} → ${run.git_after_sha}` : 'No Git change recorded';
  return { statusLabel, git, track: run.track ?? 'No track recorded', money: run.money ?? 'No settled money recorded', approvals: run.approvals ?? 'No approval summary recorded' };
}
