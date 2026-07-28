import type { PoolClient } from 'pg';
import { audit, controls, pool } from './db.ts';
import { evaluateAction } from './policy.ts';

export type Job = { id: string; action_kind: 'job'; idempotency_key: string; attempts: number; max_attempts: number };
export type ClaimedJob = { job: Job; runId: string };
const retryDelaySeconds = 60;

async function finishRun(client: PoolClient, runId: string, status: 'completed' | 'failed', output: Record<string, unknown> | null, error: string | null) {
  await client.query(
    `UPDATE job_runs SET status=$2, finished_at=now(), duration_ms=GREATEST(0, (EXTRACT(EPOCH FROM (now() - started_at)) * 1000)::integer), output=$3, error=$4 WHERE id=$1 AND finished_at IS NULL`,
    [runId, status, output ? JSON.stringify(output) : null, error],
  );
}

export async function recoverAbandonedJobs() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const recovered = await client.query<{ id: string }>(
      `UPDATE jobs SET status=CASE WHEN attempts >= max_attempts THEN 'dead_letter' ELSE 'queued' END, lease_until=NULL,
       next_run_at=CASE WHEN attempts >= max_attempts THEN next_run_at ELSE now() END, updated_at=now(), last_error='recovered_after_restart'
       WHERE status='running' AND lease_until IS NOT NULL AND lease_until < now() RETURNING id`,
    );
    for (const job of recovered.rows) {
      await client.query(`UPDATE job_runs SET status='failed', finished_at=now(), error='recovered_after_restart'
        WHERE job_id=$1 AND status='running' AND finished_at IS NULL`, [job.id]);
    }
    await client.query('COMMIT');
    if (recovered.rowCount) await audit('jobs_recovered_after_restart', 'job', null, { count: recovered.rowCount });
    return recovered.rowCount ?? 0;
  } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
}

export async function claimNextJob(): Promise<ClaimedJob | null> {
  const state = await controls();
  if (!evaluateAction(state, { kind: 'job' }).allowed) return null;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(`UPDATE jobs SET status='dead_letter', lease_until=NULL, updated_at=now(), last_error='retry_limit_exhausted'
      WHERE status='queued' AND attempts >= max_attempts`);
    const claimed = await client.query<Job>(
      `WITH candidate AS (SELECT id FROM jobs WHERE status='queued' AND attempts < max_attempts AND next_run_at <= now()
       ORDER BY next_run_at, created_at FOR UPDATE SKIP LOCKED LIMIT 1)
       UPDATE jobs SET status='running', attempts=attempts+1, lease_until=now()+interval '5 minutes', updated_at=now()
       WHERE id IN (SELECT id FROM candidate) RETURNING id, action_kind, idempotency_key, attempts, max_attempts`,
    );
    if (!claimed.rowCount) { await client.query('COMMIT'); return null; }
    const job = claimed.rows[0];
    const run = await client.query<{ id: string }>("INSERT INTO job_runs(job_id,status) VALUES($1,'running') RETURNING id", [job.id]);
    await client.query('COMMIT');
    return { job, runId: run.rows[0].id };
  } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
}

export async function executeInternalJob(claim: ClaimedJob): Promise<'completed' | 'already_completed'> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // A stale worker cannot overwrite a job recovered and claimed by another worker.
    const active = await client.query("SELECT id FROM jobs WHERE id=$1 AND status='running' AND lease_until > now() FOR UPDATE", [claim.job.id]);
    if (!active.rowCount) throw new Error('job_lease_lost');
    const effect = await client.query<{ id: string }>(
      `INSERT INTO job_effects(job_id,run_id,effect_key,effect_type,status,result) VALUES($1,$2,$3,'internal','completed',$4)
       ON CONFLICT (job_id,effect_key) DO NOTHING RETURNING id`,
      [claim.job.id, claim.runId, claim.job.idempotency_key, JSON.stringify({ result: 'internal_job_completed' })],
    );
    const outcome = effect.rowCount ? 'completed' : 'already_completed';
    await finishRun(client, claim.runId, 'completed', { result: outcome }, null);
    await client.query("UPDATE jobs SET status='completed', lease_until=NULL, updated_at=now(), last_error=NULL WHERE id=$1", [claim.job.id]);
    await client.query('COMMIT');
    await audit('job_completed', 'job', claim.job.id, { idempotency_key: claim.job.idempotency_key, outcome });
    return outcome;
  } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
}

export async function failJob(claim: ClaimedJob, error: unknown) {
  const message = error instanceof Error ? error.message.slice(0, 1000) : 'job_execution_failed';
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await client.query<{ attempts: number; max_attempts: number }>("SELECT attempts,max_attempts FROM jobs WHERE id=$1 AND status='running' FOR UPDATE", [claim.job.id]);
    if (!result.rowCount) { await client.query('COMMIT'); return; }
    const exhausted = result.rows[0].attempts >= result.rows[0].max_attempts;
    await finishRun(client, claim.runId, 'failed', null, message);
    await client.query(`UPDATE jobs SET status=$2, lease_until=NULL, next_run_at=CASE WHEN $2='queued' THEN now()+($3 * interval '1 second') ELSE next_run_at END,
      updated_at=now(), last_error=$4 WHERE id=$1`, [claim.job.id, exhausted ? 'dead_letter' : 'queued', retryDelaySeconds, message]);
    await client.query('COMMIT');
    await audit(exhausted ? 'job_dead_lettered' : 'job_retry_scheduled', 'job', claim.job.id, { error: message });
  } catch (failure) { await client.query('ROLLBACK'); throw failure; } finally { client.release(); }
}
