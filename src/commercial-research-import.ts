import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { actorContext } from './actor.ts';
import { pool } from './db.ts';
import { authorizeEffect } from './effects.ts';

const experimentKey = 'commercial-opportunity-research-2026-07-29-v1';
const evidenceFiles = [
  {
    kind: 'commercial_opportunity_ledger',
    path: 'research/autonomous-revenue-opportunity-ledger-2026-07-29.md',
  },
  {
    kind: 'commercial_offer_packet',
    path: 'commercial/automation-reliability-sprint.md',
  },
  {
    kind: 'manual_operations_log',
    path: 'evidence/manual-operations-log-2026-07-29.md',
  },
] as const;

const evidence = await Promise.all(
  evidenceFiles.map(async (item) => {
    const body = await readFile(item.path);
    return {
      ...item,
      checksum: createHash('sha256').update(body).digest('hex'),
      bytes: body.byteLength,
    };
  }),
);

const resultBody = JSON.stringify({
  experiment: experimentKey,
  method: 'Deep public-source research, platform/API inspection, existing-asset audit, and read-only Base chain measurement.',
  selected_offer: 'Automation Reliability Sprint',
  pilot_price_usd: 99,
  standard_price_usd: 249,
  crypto_decision: 'Prefer Base software rewards; monitor PoolTogether without funding a wallet.',
  pooltogether_7d_successful_gross_net_eth: '0.009200595154001442',
  external_messages: 0,
  accounts_created: 0,
  spend_minor: 0,
  revenue_minor: 0,
  evidence: evidence.map(({ kind, path, checksum, bytes }) => ({ kind, path, checksum, bytes })),
});
const resultChecksum = createHash('sha256').update(resultBody).digest('hex');

const client = await pool.connect();
try {
  await client.query('BEGIN');
  await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [experimentKey]);

  const existing = await client.query<{ id: string }>(
    'SELECT id FROM experiments WHERE method=$1',
    [experimentKey],
  );
  if (existing.rows[0]) {
    await client.query('COMMIT');
    console.log(JSON.stringify({ duplicate: true, experiment_id: existing.rows[0].id }));
  } else {
    const venture = await client.query<{ id: string }>(
      `INSERT INTO ventures(
         name, thesis, target_user, problem, offer, revenue_model,
         distribution_strategy, stage, capital_allocated_minor, evidence, risks,
         next_milestone, kill_criteria, status
       )
       VALUES(
         'Automation Reliability Sprint',
         'A narrow reliability repair offer can monetize existing automation and Agent OS engineering capability faster than building an audience or risking crypto capital.',
         'Small teams with a failing n8n, API, or AI workflow',
         'Production automations fail through missing idempotency, bounded retries, observability, and reproducible acceptance checks.',
         'Repair one bounded workflow and add safe retries, duplicate protection, logging, alerts, tests, and handoff documentation.',
         'Fixed-price service: USD 99 pilot, USD 249 standard, expansion only after measured delivery economics.',
         'Direct or automation-compatible distribution after the production gate; OSS bounties and x402 remain secondary tests.',
         'validated_offer_prelaunch',
         0,
         $1,
         $2,
         'Launch one bounded zero-cost demand-validation cycle after every P0 gate passes and the owner releases scoped authority.',
         'Pause or revise after 20 qualified pitches or 100 qualified page views with no positive response; stop on unclear authorization or poor contribution margin.',
         'research'
       )
       ON CONFLICT(name) DO UPDATE SET
         evidence=EXCLUDED.evidence,
         risks=EXCLUDED.risks,
         next_milestone=EXCLUDED.next_milestone,
         updated_at=now()
       RETURNING id`,
      [
        JSON.stringify(evidence.map(({ kind, path, checksum }) => ({ kind, uri: `file://${path}`, checksum }))),
        JSON.stringify([
          'Commercial lock remains active.',
          'No validated acquisition channel yet.',
          'Marketplace identity and automation restrictions.',
          'Scope creep and customer-data exposure.',
        ]),
      ],
    );

    const objective = await client.query<{ id: string }>(
      `INSERT INTO objectives(
         statement, status, description, venture_id, acceptance_criteria, expected_value
       )
       VALUES(
         'Select and package the highest-expected-value lawful first revenue experiment',
         'active',
         'Compare service, marketplace, bounty, digital-product, Base builder, x402, and keeper opportunities using current evidence.',
         $1,
         'A ranked evidence ledger, one bounded offer, explicit kill rules, zero external effects, and a durable decision.',
         1
       )
       RETURNING id`,
      [venture.rows[0].id],
    );

    const experiment = await client.query<{ id: string }>(
      `INSERT INTO experiments(
         venture_id, objective_id, hypothesis, target_customer, method,
         budget_minor, start_at, review_at, success_metric, failure_metric,
         stop_loss_minor, status, actual_expense_minor, actual_revenue_minor
       )
       VALUES(
         $1, $2,
         'A productized automation reliability service has higher first-revenue expected value than agent marketplaces, content, existing desktop products, or funded keeper operation.',
         'Small technical teams operating unreliable automations',
         $3,
         0,
         '2026-07-29T00:00:00+05:30',
         now(),
         'Current buyer evidence, a differentiated bounded offer, delivery controls, and explicit experiment kill rules exist.',
         'No credible demand evidence or a competing opportunity with materially higher risk-adjusted expected value.',
         0,
         'running',
         0,
         0
       )
       RETURNING id`,
      [venture.rows[0].id, objective.rows[0].id, experimentKey],
    );

    const task = await client.query<{ id: string }>(
      `INSERT INTO tasks(
         venture_id, objective_id, experiment_id, title, description, status,
         priority, expected_value, cost_estimate_minor, decision_or_hypothesis,
         acceptance_criteria, created_by, updated_by
       )
       VALUES(
         $1, $2, $3,
         'Research and package the first autonomous revenue experiment',
         'Audit current demand, platforms, crypto infrastructure opportunities, and existing assets; package the selected offer without external action.',
         'in_progress',
         100,
         1,
         0,
         'Automation reliability has the strongest bounded first-revenue economics.',
         'Evidence ledger, offer packet, manual log, read-only keeper measurement, durable decision, zero spend, and zero outreach.',
         'goofy',
         'goofy'
       )
       RETURNING id`,
      [venture.rows[0].id, objective.rows[0].id, experiment.rows[0].id],
    );

    const job = await client.query<{ id: string }>(
      `INSERT INTO jobs(
         name, purpose, action_kind, payload, idempotency_key, status, attempts,
         max_attempts, related_venture_id, related_ticket_id
       )
       VALUES(
         'Commercial research evidence import',
         'Persist the completed zero-cost opportunity research in the authoritative control plane.',
         'job',
         $1,
         $2,
         'running',
         1,
         1,
         $3,
         $4
       )
       RETURNING id`,
      [
        JSON.stringify({ experiment_id: experiment.rows[0].id, evidence }),
        experimentKey,
        venture.rows[0].id,
        task.rows[0].id,
      ],
    );

    const run = await client.query<{ id: string }>(
      `INSERT INTO job_runs(job_id,status,attempt,worker_id,cost_minor)
       VALUES($1,'running',1,'commercial-research-import',0)
       RETURNING id`,
      [job.rows[0].id],
    );

    const effect = await authorizeEffect(
      client,
      {
        idempotencyKey: `${experimentKey}:effect`,
        kind: 'internal',
        jobId: job.rows[0].id,
        runId: run.rows[0].id,
        payload: {
          ventureId: venture.rows[0].id,
          experimentId: experiment.rows[0].id,
          ticketId: task.rows[0].id,
          resultChecksum,
        },
      },
      actorContext({
        actorType: 'worker',
        actorId: 'commercial-research-import',
        credentialScope: 'effects:internal',
        originPlatform: 'cli',
      }),
    );
    if (effect.state !== 'authorized') {
      throw new Error(`internal_effect_${effect.state}`);
    }

    const artifactIds: string[] = [];
    for (const item of evidence) {
      const artifact = await client.query<{ id: string }>(
        `INSERT INTO artifacts(kind,uri,checksum,venture_id)
         VALUES($1,$2,$3,$4)
         RETURNING id`,
        [item.kind, `file://${item.path}`, item.checksum, venture.rows[0].id],
      );
      artifactIds.push(artifact.rows[0].id);
      await client.query(
        'INSERT INTO task_artifacts(task_id,artifact_id) VALUES($1,$2)',
        [task.rows[0].id, artifact.rows[0].id],
      );
    }

    const resultArtifact = await client.query<{ id: string }>(
      `INSERT INTO artifacts(kind,uri,checksum,venture_id)
       VALUES('commercial_research_result',$1,$2,$3)
       RETURNING id`,
      [
        `data:application/json,${encodeURIComponent(resultBody)}`,
        resultChecksum,
        venture.rows[0].id,
      ],
    );
    artifactIds.push(resultArtifact.rows[0].id);
    await client.query(
      'INSERT INTO task_artifacts(task_id,artifact_id) VALUES($1,$2)',
      [task.rows[0].id, resultArtifact.rows[0].id],
    );

    const receipt = {
      artifact_ids: artifactIds,
      result_checksum: resultChecksum,
      external_messages: 0,
      accounts_created: 0,
      spend_minor: 0,
      revenue_minor: 0,
    };
    await client.query(
      `INSERT INTO job_effects(job_id,run_id,effect_key,effect_type,status,result)
       VALUES($1,$2,$3,'internal','completed',$4)`,
      [job.rows[0].id, run.rows[0].id, `${experimentKey}:effect`, JSON.stringify(receipt)],
    );
    await client.query(
      `UPDATE effect_intents
       SET state='succeeded',receipt=$2,finished_at=now(),updated_at=now()
       WHERE id=$1`,
      [effect.id, JSON.stringify(receipt)],
    );

    const decision = await client.query<{ id: string }>(
      `INSERT INTO decisions(
         statement, context, options, evidence, selected_option, rejected_options,
         expected_result, confidence, cost_minor, risk, review_at, actual_outcome, lesson
       )
       VALUES(
         'Lead with the Automation Reliability Sprint when commercial execution is unlocked.',
         'Current public demand, platform economics, owner assets, crypto keeper economics, payout friction, and mission controls were compared.',
         $1,
         $2,
         'automation_reliability_sprint',
         $3,
         'Reach one settled paid pilot with bounded delivery cost before expanding.',
         85,
         0,
         'low before launch; customer access and scope require controls',
         now() + interval '30 days',
         'Offer packaged privately; no external validation or revenue yet.',
         'Sell a narrow engineering outcome first; treat Base rewards and bounties as secondary shots and keeper operation as monitor-only.'
       )
       RETURNING id`,
      [
        JSON.stringify([
          'automation_reliability_sprint',
          'agent_release_gate',
          'base_builder_tool',
          'oss_bounties',
          'x402_endpoint',
          'pooltogether_claimer',
          'agent_marketplaces',
          'content_or_stock_assets',
        ]),
        JSON.stringify(evidence.map(({ kind, path, checksum }) => ({ kind, uri: `file://${path}`, checksum }))),
        JSON.stringify([
          'agent_release_gate_as_primary',
          'base_builder_tool_as_primary',
          'oss_bounties_as_primary',
          'x402_endpoint_as_primary',
          'pooltogether_claimer_as_primary',
          'agent_marketplaces_as_primary',
          'content_or_stock_assets_as_primary',
        ]),
      ],
    );

    await client.query(
      `UPDATE experiments
       SET status='completed',
           actual_result=$2,
           lesson=$3,
           follow_up_decision='launch_after_production_and_approval_gates',
           decision='continue',
           updated_at=now()
       WHERE id=$1`,
      [
        experiment.rows[0].id,
        'Automation Reliability Sprint ranked first and was packaged; Base builder software ranked as the best crypto track; PoolTogether remained monitor-only.',
        'Current agent markets have negligible settled demand, while narrowly scoped automation work has observable buyer demand and no inventory requirement.',
      ],
    );
    await client.query(
      `UPDATE tasks
       SET status='completed',
           actual_cost_minor=0,
           completion_evidence=$2,
           verification_evidence=$3,
           updated_at=now()
       WHERE id=$1`,
      [
        task.rows[0].id,
        artifactIds.map((id) => `artifact:${id}`).join(','),
        resultChecksum,
      ],
    );
    await client.query(
      `UPDATE objectives SET status='completed',updated_at=now() WHERE id=$1`,
      [objective.rows[0].id],
    );
    await client.query(
      `UPDATE jobs
       SET status='completed',last_run_at=now(),updated_at=now()
       WHERE id=$1`,
      [job.rows[0].id],
    );
    await client.query(
      `UPDATE job_runs
       SET status='completed',finished_at=now(),duration_ms=0,output=$2
       WHERE id=$1`,
      [run.rows[0].id, JSON.stringify({ decision_id: decision.rows[0].id, ...receipt })],
    );
    await client.query(
      `INSERT INTO activity_events(
         actor_type, actor_id, event_type, entity_type, entity_id, venture_id,
         objective_id, task_id, experiment_id, evidence, selected_action,
         confidence, expected_outcome, actual_outcome, lesson, payload
       )
       VALUES(
         'agent',
         'goofy',
         'commercial_research_completed',
         'experiment',
         $1::uuid::text,
         $2,
         $3,
         $4,
         $1::uuid,
         $5,
         'automation_reliability_sprint',
         85,
         'Select a bounded first-revenue experiment.',
         'Offer packaged with zero spend and zero external effects.',
         'Lead with a narrow service; keep crypto capital at zero until evidence changes.',
         $6
       )`,
      [
        experiment.rows[0].id,
        venture.rows[0].id,
        objective.rows[0].id,
        task.rows[0].id,
        JSON.stringify(evidence.map(({ kind, path, checksum }) => ({ kind, uri: `file://${path}`, checksum }))),
        JSON.stringify(receipt),
      ],
    );

    await client.query('COMMIT');
    console.log(
      JSON.stringify({
        duplicate: false,
        venture_id: venture.rows[0].id,
        objective_id: objective.rows[0].id,
        experiment_id: experiment.rows[0].id,
        task_id: task.rows[0].id,
        job_id: job.rows[0].id,
        effect_id: effect.id,
        decision_id: decision.rows[0].id,
        artifact_ids: artifactIds,
        result_checksum: resultChecksum,
      }),
    );
  }
} catch (error) {
  await client.query('ROLLBACK');
  throw error;
} finally {
  client.release();
  await pool.end();
}
