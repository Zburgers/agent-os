import { audit, controls, pool } from './db.ts';
import { evaluateAction } from './policy.ts';

async function recoverAbandonedJobs() {
  const { rowCount } = await pool.query("UPDATE jobs SET status='queued',lease_until=NULL,updated_at=now(),last_error='recovered_after_restart' WHERE status='running' AND lease_until < now()");
  if (rowCount) await audit('jobs_recovered', 'job', null, { count: rowCount });
}

async function runOnce() {
  const state = await controls();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const claimed = await client.query("WITH candidate AS (SELECT id FROM jobs WHERE status='queued' AND next_run_at <= now() ORDER BY created_at FOR UPDATE SKIP LOCKED LIMIT 1) UPDATE jobs SET status='running',attempts=attempts+1,lease_until=now()+interval '5 minutes',updated_at=now() WHERE id IN (SELECT id FROM candidate) RETURNING *");
    if (!claimed.rowCount) { await client.query('COMMIT'); return false; }
    const job = claimed.rows[0]; const permitted = evaluateAction(state, { kind: job.action_kind });
    if (!permitted.allowed) {
      await client.query("UPDATE jobs SET status='queued', lease_until=NULL, next_run_at=now()+interval '5 minutes', last_error=$2 WHERE id=$1", [job.id, permitted.reason]);
      await client.query('COMMIT'); return false;
    }
    const run = await client.query("INSERT INTO job_runs(job_id,status) VALUES($1,'running') RETURNING id", [job.id]);
    await client.query("UPDATE job_runs SET status='completed',finished_at=now(),duration_ms=0,output=$2 WHERE id=$1", [run.rows[0].id, JSON.stringify({ result: 'internal_job_completed' })]);
    await client.query("UPDATE jobs SET status='completed',lease_until=NULL,updated_at=now() WHERE id=$1", [job.id]);
    await client.query('COMMIT'); await audit('job_completed', 'job', job.id, { idempotency_key: job.idempotency_key }); return true;
  } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
}

await recoverAbandonedJobs();
const executed = await runOnce();
console.log(JSON.stringify({ worker: 'completed', executed }));
await pool.end();
