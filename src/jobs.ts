import type { PoolClient } from 'pg';
import { audit, controls, pool } from './db.ts';
import { evaluateAction } from './policy.ts';
import { actorContext } from './actor.ts';
import { authorizeEffect } from './effects.ts';
import { buildDailyBriefData } from './daily-brief.ts';
import { fetchNearBidStatus, loadNearAgentCredential, shouldAlertForBidStatus } from './near-bid-monitor.ts';
import { runRevenueMarketScout } from './revenue-market-scout.ts';
import { enqueueJobSuccessNotifications, loadJobSuccessNotificationConfig } from './job-success-notifications.ts';

export type Job = { id: string; action_kind: 'job'; payload: Record<string, unknown>; idempotency_key: string; current_occurrence_key: string; attempts: number; max_attempts: number; interval_seconds: number | null };
export type ClaimedJob = { job: Job; runId: string };
const retryDelaySeconds = 60;
const jobSuccessNotificationConfig = loadJobSuccessNotificationConfig(process.env);

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

export async function claimNextJob(workerId = 'one-shot-worker'): Promise<ClaimedJob | null> {
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
       UPDATE jobs SET status='running', attempts=attempts+1, lease_until=now()+interval '5 minutes',
       claimed_by=$1, heartbeat_at=now(), updated_at=now(),
       current_occurrence_key=COALESCE(current_occurrence_key,idempotency_key || ':' || to_char(next_run_at AT TIME ZONE 'UTC','YYYYMMDDHH24MISSUS'))
       WHERE id IN (SELECT id FROM candidate) RETURNING id, action_kind, payload, idempotency_key,current_occurrence_key,attempts,max_attempts,interval_seconds`,
      [workerId],
    );
    if (!claimed.rowCount) { await client.query('COMMIT'); return null; }
    const job = claimed.rows[0];
    const run = await client.query<{ id: string }>("INSERT INTO job_runs(job_id,status,attempt,worker_id) VALUES($1,'running',$2,$3) RETURNING id", [job.id, job.attempts, workerId]);
    await client.query('COMMIT');
    return { job, runId: run.rows[0].id };
  } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
}

export async function heartbeatJob(claim: ClaimedJob, workerId: string) {
  const result = await pool.query(
    `UPDATE jobs SET lease_until=now()+interval '5 minutes',heartbeat_at=now(),updated_at=now()
     WHERE id=$1 AND status='running' AND claimed_by=$2 AND lease_until>now()`,
    [claim.job.id, workerId],
  );
  if (!result.rowCount) throw new Error('job_lease_lost');
}

export async function executeInternalJob(claim: ClaimedJob): Promise<'completed' | 'already_completed'> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // A stale worker cannot overwrite a job recovered and claimed by another worker.
    const active = await client.query("SELECT id FROM jobs WHERE id=$1 AND status='running' AND lease_until > now() FOR UPDATE", [claim.job.id]);
    if (!active.rowCount) throw new Error('job_lease_lost');
    const intent = await authorizeEffect(client, {
      idempotencyKey: claim.job.current_occurrence_key,
      kind: 'internal',
      jobId: claim.job.id,
      runId: claim.runId,
    }, actorContext({
      actorType: 'worker',
      actorId: 'durable-supervisor',
      credentialScope: 'effects:internal',
      originPlatform: 'supervisor',
    }));
    if (intent.state === 'denied') throw new Error(intent.policyCode ?? 'effect_denied');
    const dailyBrief = claim.job.payload?.kind === 'daily_owner_brief_snapshot'
      ? await buildDailyBriefData(client)
      : null;
    const nearBid = claim.job.payload?.kind === 'near_bid_status_monitor'
      ? await fetchNearBidStatus({
          bidId: String(claim.job.payload.bid_id ?? ''),
          apiKey: (await loadNearAgentCredential(process.env.NEAR_AGENT_CREDENTIAL_FILE ?? '')).apiKey,
          signal: AbortSignal.timeout(10_000),
        })
      : null;
    const marketScout = claim.job.payload?.kind === 'revenue_market_scout'
      ? await runRevenueMarketScout()
      : null;
    const previousNearRun = nearBid
      ? await client.query<{ status: string }>(
          `SELECT output->'bid'->>'status' AS status FROM job_runs
           WHERE job_id=$1 AND id<>$2 AND status='completed' AND output->'bid'->>'status' IS NOT NULL
           ORDER BY finished_at DESC,id DESC LIMIT 1`,
          [claim.job.id, claim.runId],
        )
      : null;
    const previousNearStatus = previousNearRun?.rows[0]?.status;
    const nearAlert = nearBid ? shouldAlertForBidStatus(previousNearStatus, nearBid.status) : false;
    const effectResult = dailyBrief
      ? { report: 'daily_owner_brief', route: '/daily-brief', generated_at: dailyBrief.generatedAt, snapshot: dailyBrief }
      : nearBid
        ? { monitor: 'near_bid_status', bid: nearBid, previous_status: previousNearStatus ?? null, alert: nearAlert }
        : marketScout
          ? { monitor: 'revenue_market_scout', ...marketScout }
      : { result: 'internal_job_completed' };
    const effect = await client.query<{ id: string }>(
      `INSERT INTO job_effects(job_id,run_id,effect_key,effect_type,status,result) VALUES($1,$2,$3,'internal','completed',$4)
       ON CONFLICT (job_id,effect_key) DO NOTHING RETURNING id`,
      [claim.job.id, claim.runId, claim.job.current_occurrence_key, JSON.stringify(effectResult)],
    );
    const outcome = effect.rowCount ? 'completed' : 'already_completed';
    let notification: Record<string, unknown> | undefined;
    let notificationEnqueueFailed = false;
    await client.query('SAVEPOINT job_success_notification');
    try {
      notification = await enqueueJobSuccessNotifications(
        client,
        claim.job,
        claim.runId,
        effectResult as Record<string, unknown>,
        jobSuccessNotificationConfig,
      );
      await client.query('RELEASE SAVEPOINT job_success_notification');
    } catch {
      notificationEnqueueFailed = true;
      await client.query('ROLLBACK TO SAVEPOINT job_success_notification');
      await client.query('RELEASE SAVEPOINT job_success_notification');
    }
    const runOutput = {
      result: outcome,
      ...effectResult,
      telegram_notification: notification ?? { enqueued: 0, duplicates: 0, denied: 1, reason: 'enqueue_failed' },
    };
    await client.query(
      `UPDATE effect_intents SET state='succeeded',receipt=$2,finished_at=now(),updated_at=now()
       WHERE id=$1 AND state='authorized'`,
      [intent.id, JSON.stringify(runOutput)],
    );
    await finishRun(client, claim.runId, 'completed', runOutput, null);
    if (nearBid && nearAlert) {
      await client.query(
        `INSERT INTO audit_events(actor_type,actor_id,event_type,entity_type,entity_id,payload)
         VALUES('worker','near-bid-monitor','near_bid_status_alert','job',$1,$2)`,
        [claim.job.id, JSON.stringify({ bid_id: nearBid.id, job_id: nearBid.jobId, previous_status: previousNearStatus ?? null, status: nearBid.status, amount: nearBid.amount, budget_token: nearBid.budgetToken })],
      );
    }
    await client.query(
      `UPDATE jobs SET status=CASE WHEN interval_seconds IS NULL THEN 'completed' ELSE 'queued' END,
       next_run_at=CASE WHEN interval_seconds IS NULL THEN next_run_at ELSE now()+(interval_seconds * interval '1 second') END,
       last_run_at=now(),last_scheduled_at=CASE WHEN interval_seconds IS NULL THEN last_scheduled_at ELSE now() END,
       current_occurrence_key=NULL,attempts=CASE WHEN interval_seconds IS NULL THEN attempts ELSE 0 END,
       lease_until=NULL,claimed_by=NULL,updated_at=now(),last_error=NULL WHERE id=$1`,
      [claim.job.id],
    );
    await client.query('COMMIT');
    await audit('job_completed', 'job', claim.job.id, { idempotency_key: claim.job.idempotency_key, outcome });
    if (notificationEnqueueFailed) {
      await audit('job_success_notification_enqueue_failed', 'job', claim.job.id, { reason: 'notification_enqueue_failed' });
    }
    if (dailyBrief) await audit('daily_owner_brief_generated', 'job', claim.job.id, { route: '/daily-brief', generated_at: dailyBrief.generatedAt });
    if (nearBid) await audit('near_bid_status_checked', 'job', claim.job.id, { bid_id: nearBid.id, status: nearBid.status, alert: nearAlert });
    if (marketScout) await audit('revenue_market_scout_completed', 'job', claim.job.id, { source_count: marketScout.sources.length, opportunity_count: marketScout.opportunities.length, failure_count: marketScout.failures.length });
    return outcome;
  } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
}

export async function cancelJob(jobId: string, actorId: string) {
  const result = await pool.query(
    `UPDATE jobs SET status='cancelled',cancelled_at=now(),lease_until=NULL,updated_at=now()
     WHERE id=$1 AND status IN ('queued','paused','running') RETURNING id`,
    [jobId],
  );
  if (!result.rowCount) throw new Error('job_not_cancellable');
  await audit('job_cancelled', 'job', jobId, {}, actorId);
}

export async function rerunJob(jobId: string, actorId: string) {
  const result = await pool.query(
    `UPDATE jobs SET status='queued',attempts=0,current_occurrence_key=NULL,next_run_at=now(),last_error=NULL,
     cancelled_at=NULL,updated_at=now() WHERE id=$1 AND status IN ('completed','dead_letter','cancelled','paused') RETURNING id`,
    [jobId],
  );
  if (!result.rowCount) throw new Error('job_not_rerunnable');
  await audit('job_rerun_queued', 'job', jobId, {}, actorId);
}

export async function pauseJob(jobId: string, actorId: string) {
  const result = await pool.query(
    `UPDATE jobs SET status='paused',paused_at=now(),lease_until=NULL,updated_at=now()
     WHERE id=$1 AND status='queued' RETURNING id`,
    [jobId],
  );
  if (!result.rowCount) throw new Error('job_not_pausable');
  await audit('job_paused', 'job', jobId, {}, actorId);
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
