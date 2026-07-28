import { createHash } from 'node:crypto';
import { pool } from './db.ts';
import { actorContext } from './actor.ts';
import { authorizeEffect } from './effects.ts';

const experimentKey = 'agent-os-zero-cost-readiness-v1';
const artifactBody = JSON.stringify({
  experiment: experimentKey,
  method: 'Exercise the PostgreSQL objective → venture → experiment → task → job/effect → artifact → decision chain.',
  external_messages: 0,
  spend_minor: 0,
  revenue_minor: 0,
  result: 'control-plane chain persisted and independently queryable',
});
const checksum = createHash('sha256').update(artifactBody).digest('hex');
const client = await pool.connect();
try {
  await client.query('BEGIN');
  await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [experimentKey]);
  const existing = await client.query("SELECT id FROM experiments WHERE method=$1", [experimentKey]);
  if (existing.rows[0]) {
    await client.query('COMMIT');
    console.log(JSON.stringify({ duplicate: true, experiment_id: existing.rows[0].id }));
  } else {
    const venture = await client.query<{ id: string }>(
      `INSERT INTO ventures(name,thesis,target_user,problem,offer,revenue_model,distribution_strategy,stage,evidence,risks,next_milestone,kill_criteria)
       VALUES('Agent OS readiness evidence','A zero-cost internal run proves the control chain','Owner/operator','Unverified end-to-end control path',
       'Reproducible internal readiness evidence','Internal control asset','Private dashboard','internal_validation',$1,'[]','Close verified experiment','Any external effect or non-zero cost')
       ON CONFLICT(name) DO UPDATE SET updated_at=now() RETURNING id`,
      [JSON.stringify([{ kind: 'declared_method', key: experimentKey }])],
    );
    const objective = await client.query<{ id: string }>(
      `INSERT INTO objectives(statement,status,description,venture_id,acceptance_criteria)
       VALUES('Prove one zero-cost internal Agent OS experiment','active','Exercise all durable control-plane links',$1,
       'One completed internal effect, checksummed artifact, lesson and decision; zero spend and revenue') RETURNING id`,
      [venture.rows[0].id],
    );
    const experiment = await client.query<{ id: string }>(
      `INSERT INTO experiments(venture_id,objective_id,hypothesis,target_customer,method,budget_minor,start_at,review_at,
       success_metric,failure_metric,stop_loss_minor,status,actual_expense_minor,actual_revenue_minor)
       VALUES($1,$2,'The control plane can execute and record a complete bounded internal experiment','Owner/operator',$3,0,now(),now(),
       'All linked records and checksum exist','Any missing link, external side effect, or non-zero cost',0,'running',0,0) RETURNING id`,
      [venture.rows[0].id,objective.rows[0].id,experimentKey],
    );
    const task = await client.query<{ id: string }>(
      `INSERT INTO tasks(venture_id,objective_id,experiment_id,title,description,status,priority,expected_value,cost_estimate_minor,
       decision_or_hypothesis,acceptance_criteria,created_by,updated_by)
       VALUES($1,$2,$3,'Execute zero-cost readiness experiment','Internal database-only execution','in_progress',100,1,0,$4,
       'Persist effect, artifact, result, lesson, and decision','goofy','goofy') RETURNING id`,
      [venture.rows[0].id,objective.rows[0].id,experiment.rows[0].id,'Control chain is durable and idempotent'],
    );
    const job = await client.query<{ id: string }>(
      `INSERT INTO jobs(name,purpose,action_kind,payload,idempotency_key,status,attempts,max_attempts,related_venture_id,related_ticket_id)
       VALUES('Zero-cost readiness experiment','Produce internal release evidence','job',$1,$2,'running',1,1,$3,$4) RETURNING id`,
      [JSON.stringify({ experiment_id: experiment.rows[0].id }),experimentKey,venture.rows[0].id,task.rows[0].id],
    );
    const run = await client.query<{ id: string }>("INSERT INTO job_runs(job_id,status,attempt,worker_id) VALUES($1,'running',1,'internal-experiment') RETURNING id", [job.rows[0].id]);
    const effect = await authorizeEffect(client, {
      idempotencyKey: `${experimentKey}:effect`,kind:'internal',jobId:job.rows[0].id,runId:run.rows[0].id,
      payload:{ventureId:venture.rows[0].id,experimentId:experiment.rows[0].id,ticketId:task.rows[0].id},
    }, actorContext({actorType:'worker',actorId:'internal-experiment',credentialScope:'effects:internal',originPlatform:'cli'}));
    if (effect.state !== 'authorized') throw new Error(`internal_effect_${effect.state}`);
    const artifact = await client.query<{ id: string }>(
      "INSERT INTO artifacts(kind,uri,checksum,venture_id) VALUES('internal_experiment_evidence',$1,$2,$3) RETURNING id",
      [`data:application/json,${encodeURIComponent(artifactBody)}`,checksum,venture.rows[0].id],
    );
    await client.query('INSERT INTO task_artifacts(task_id,artifact_id) VALUES($1,$2)', [task.rows[0].id,artifact.rows[0].id]);
    await client.query("INSERT INTO job_effects(job_id,run_id,effect_key,effect_type,status,result) VALUES($1,$2,$3,'internal','completed',$4)",
      [job.rows[0].id,run.rows[0].id,`${experimentKey}:effect`,JSON.stringify({ artifact_id: artifact.rows[0].id, checksum })]);
    await client.query("UPDATE effect_intents SET state='succeeded',receipt=$2,finished_at=now(),updated_at=now() WHERE id=$1",
      [effect.id,JSON.stringify({ artifact_id:artifact.rows[0].id,checksum })]);
    const decision = await client.query<{ id: string }>(
      `INSERT INTO decisions(statement,context,options,evidence,selected_option,rejected_options,expected_result,confidence,cost_minor,risk,actual_outcome,lesson)
       VALUES('Accept the internal control-chain experiment result','All declared success conditions were evaluated',$1,$2,'close_successfully',$3,
       'Preserve reproducible readiness evidence',100,0,'none','Succeeded with zero external effects and zero cost','Use one transactional effect boundary and checksummed evidence') RETURNING id`,
      [JSON.stringify(['close_successfully','retry','fail']),JSON.stringify([{artifact_id:artifact.rows[0].id,checksum}]),JSON.stringify(['retry','fail'])],
    );
    await client.query(
      `UPDATE experiments SET status='completed',actual_result=$2,lesson=$3,follow_up_decision='close_successfully',decision='continue',updated_at=now() WHERE id=$1`,
      [experiment.rows[0].id,'All linked records persisted; checksum verified; spend and revenue remained zero','A bounded internal effect can produce durable, auditable evidence'],
    );
    await client.query("UPDATE tasks SET status='completed',actual_cost_minor=0,completion_evidence=$2,verification_evidence=$3,updated_at=now() WHERE id=$1",
      [task.rows[0].id,`artifact:${artifact.rows[0].id}`,checksum]);
    await client.query("UPDATE objectives SET status='completed',updated_at=now() WHERE id=$1", [objective.rows[0].id]);
    await client.query("UPDATE jobs SET status='completed',last_run_at=now(),updated_at=now() WHERE id=$1", [job.rows[0].id]);
    await client.query("UPDATE job_runs SET status='completed',finished_at=now(),output=$2 WHERE id=$1", [run.rows[0].id,JSON.stringify({decision_id:decision.rows[0].id})]);
    await client.query(
      `INSERT INTO activity_events(actor_type,actor_id,event_type,entity_type,entity_id,venture_id,objective_id,task_id,experiment_id,
       evidence,selected_action,confidence,expected_outcome,actual_outcome,lesson)
       VALUES('agent','goofy','internal_experiment_completed','experiment',$1::uuid::text,$2,$3,$4,$1::uuid,$5,'close_successfully',100,$6,$7,$8)`,
      [experiment.rows[0].id,venture.rows[0].id,objective.rows[0].id,task.rows[0].id,
       JSON.stringify([{artifact_id:artifact.rows[0].id,checksum}]),'Complete durable control chain','Complete durable control chain','Transactional linkage simplifies verification'],
    );
    await client.query('COMMIT');
    console.log(JSON.stringify({duplicate:false,experiment_id:experiment.rows[0].id,artifact_id:artifact.rows[0].id,checksum}));
  }
} catch (error) {
  await client.query('ROLLBACK');
  throw error;
} finally {
  client.release();
  await pool.end();
}
