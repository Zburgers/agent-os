import { randomUUID } from 'node:crypto';
import { pool } from './db.ts';
import { claimNextJob, executeInternalJob, failJob, recoverAbandonedJobs } from './jobs.ts';
import { ApprovalService } from './approvals.ts';

const workerId = process.env.SUPERVISOR_ID?.trim() || `supervisor-${randomUUID()}`;
const pollMs = Math.max(250, Number(process.env.SUPERVISOR_POLL_MS ?? 1000));
let stopping = false;
const approvals = new ApprovalService(pool);
let lastApprovalExpiry = 0;

const stop = () => { stopping = true; };
process.once('SIGTERM', stop);
process.once('SIGINT', stop);

async function heartbeat(status: 'starting' | 'running' | 'stopping' | 'stopped', detail: Record<string, unknown> = {}) {
  await pool.query(
    `INSERT INTO supervisor_heartbeats(worker_id,status,detail) VALUES($1,$2,$3)
     ON CONFLICT(worker_id) DO UPDATE SET heartbeat_at=now(),status=EXCLUDED.status,detail=EXCLUDED.detail`,
    [workerId, status, JSON.stringify(detail)],
  );
}

const delay = (milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds));

try {
  await heartbeat('starting');
  const recovered = await recoverAbandonedJobs();
  await heartbeat('running', { recovered });
  while (!stopping) {
    if (Date.now() - lastApprovalExpiry >= 60_000) {
      const expired = await approvals.expirePending();
      lastApprovalExpiry = Date.now();
      if (expired.length) await heartbeat('running', { expiredApprovals: expired.length });
    }
    const claim = await claimNextJob(workerId);
    if (!claim) {
      await heartbeat('running');
      await delay(pollMs);
      continue;
    }
    try {
      await executeInternalJob(claim);
    } catch (error) {
      await failJob(claim, error);
    }
    await heartbeat('running', { lastJobId: claim.job.id });
  }
  await heartbeat('stopping');
} finally {
  await heartbeat('stopped').catch(() => undefined);
  await pool.end();
}
