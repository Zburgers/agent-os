import { pool } from './db.ts';
import { claimNextJob, executeInternalJob, failJob, recoverAbandonedJobs } from './jobs.ts';

const recovered = await recoverAbandonedJobs();
const claim = await claimNextJob();
let executed = false;
if (claim) {
  try { await executeInternalJob(claim); executed = true; }
  catch (error) { await failJob(claim, error); }
}
console.log(JSON.stringify({ worker: 'completed', recovered, executed }));
await pool.end();
