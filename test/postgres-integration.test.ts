import test from 'node:test';
import assert from 'node:assert/strict';

const enabled = process.env.RUN_POSTGRES_INTEGRATION === 'true';

test('PostgreSQL integration prerequisites are explicit', { skip: !enabled }, async () => {
  const { pool } = await import('../src/db.ts');
  const { TicketService } = await import('../src/tickets.ts');
  const { ApprovalService, ApprovalTransitionError } = await import('../src/approvals.ts');
  const { ApprovalRequestService } = await import('../src/approval-requests.ts');
  const { authorizeEffect, claimAuthorizedEffect, recordExternalResult, EffectPolicyError } = await import('../src/effects.ts');
  const { actorContext } = await import('../src/actor.ts');
  const { claimNextJob, executeInternalJob, recoverAbandonedJobs } = await import('../src/jobs.ts');
  const { applySystemControl } = await import('../src/system-controls.ts');
  const { TelegramControlService } = await import('../src/telegram-controls.ts');
  const { createOwnerSession, getOwnerSession, revokeOwnerSession } = await import('../src/auth.ts');
  const { createEntity, updateEntity } = await import('../src/entities.ts');
  const { CommercialOperationsService } = await import('../src/commercial-operations.ts');
  const { LedgerService, releaseOperatingTranche } = await import('../src/finance.ts');
  const { approvalDetail, jobDetail, ledgerDetail, listActivity, listApprovals, listHealthChecks, listIncidents, listJobs, listLedgerEntries, listTickets, ticketDetail } = await import('../src/records.ts');
  const { ChannelOutboxError, ChannelOutboxService } = await import('../src/channel-outbox.ts');

  const outboxConstraints = await pool.query<{ conname: string }>(
    `SELECT conname FROM pg_constraint
     WHERE conrelid='channel_outbox'::regclass
       AND conname IN ('channel_outbox_attempts_check','channel_outbox_max_attempts_check')
     ORDER BY conname`,
  );
  assert.deepEqual(outboxConstraints.rows.map((row) => row.conname), [
    'channel_outbox_attempts_check', 'channel_outbox_max_attempts_check',
  ]);
  const outboxColumns = await pool.query<{ column_name: string }>(
    `SELECT column_name FROM information_schema.columns
     WHERE table_schema='public' AND table_name='channel_outbox'
       AND column_name IN ('effect_intent_id','max_attempts','lease_expires_at','updated_at')
     ORDER BY column_name`,
  );
  assert.deepEqual(outboxColumns.rows.map((row) => row.column_name), [
    'effect_intent_id', 'lease_expires_at', 'max_attempts', 'updated_at',
  ]);
  const outboxTrigger = await pool.query<{ count: string }>(
    `SELECT count(*) FROM pg_trigger
     WHERE tgrelid='channel_outbox'::regclass AND tgname='channel_outbox_audit_backstop' AND NOT tgisinternal`,
  );
  assert.equal(outboxTrigger.rows[0].count, '1');

  const outboxEffect = await pool.query<{ id: string }>(
    `INSERT INTO effect_intents(effect_kind,idempotency_key,state,payload)
     VALUES('message','integration-telegram-outbox-effect','authorized','{}') RETURNING id`,
  );
  const outbox = await pool.query<{ attempts: number; max_attempts: number }>(
    `INSERT INTO channel_outbox(channel,recipient_ref,message_kind,redacted_payload,idempotency_key,effect_intent_id)
     VALUES('telegram','123456','approval_required','{"text":"Integration owner notice"}','approval:integration:owner',$1)
     RETURNING attempts,max_attempts`,
    [outboxEffect.rows[0].id],
  );
  assert.deepEqual(outbox.rows[0], { attempts: 0, max_attempts: 3 });
  await assert.rejects(
    pool.query(
      `INSERT INTO channel_outbox(channel,recipient_ref,message_kind,redacted_payload,idempotency_key,effect_intent_id)
       VALUES('telegram','integration-owner','approval_required','{}','approval:integration:owner:duplicate',$1)`,
      [outboxEffect.rows[0].id],
    ),
    /channel_outbox_effect_intent_unique/,
  );
  await assert.rejects(
    pool.query("UPDATE channel_outbox SET max_attempts=6 WHERE idempotency_key='approval:integration:owner'"),
    /channel_outbox_max_attempts_check/,
  );
  await assert.rejects(
    pool.query("UPDATE channel_outbox SET attempts=4 WHERE idempotency_key='approval:integration:owner'"),
    /channel_outbox_attempts_check/,
  );

  await pool.query('UPDATE system_controls SET commercial_lock=false WHERE singleton=true');
  const channelOutbox = new ChannelOutboxService(pool, { leaseSeconds: 60, ownerTelegramIds: ['123456'] });
  const deliveryClaim = await channelOutbox.claim();
  assert.equal(deliveryClaim.claimed, true);
  assert.equal(deliveryClaim.delivery?.text, 'Integration owner notice');
  assert.equal(deliveryClaim.delivery?.attempt, 1);
  await channelOutbox.recordResult(deliveryClaim.delivery!.id, deliveryClaim.delivery!.attempt, {
    outcome: 'succeeded',
    receipt: { providerStatus: 'sent', messageId: '42', chatId: '123456', ignored: 'must-not-persist' },
  });
  assert.deepEqual((await pool.query(
    `SELECT o.status,o.attempts,o.provider_receipt,e.state AS effect_state
     FROM channel_outbox o JOIN effect_intents e ON e.id=o.effect_intent_id WHERE o.id=$1`,
    [deliveryClaim.delivery!.id],
  )).rows[0], {
    status: 'delivered', attempts: 1,
    provider_receipt: { provider_status: 'sent', message_id: '42', chat_id: '123456' },
    effect_state: 'succeeded',
  });
  await assert.rejects(
    channelOutbox.recordResult(deliveryClaim.delivery!.id, deliveryClaim.delivery!.attempt, { outcome: 'succeeded' }),
    (error: unknown) => error instanceof ChannelOutboxError && error.code === 'invalid_delivery_state',
  );
  await pool.query('UPDATE system_controls SET commercial_lock=true WHERE singleton=true');

  async function createOutboxFixture(key: string, options: { effectState?: string; status?: string; attempts?: number; maxAttempts?: number; stale?: boolean } = {}) {
    const effect = await pool.query<{ id: string }>(
      `INSERT INTO effect_intents(effect_kind,idempotency_key,state,payload)
       VALUES('message',$1,$2,'{}') RETURNING id`,
      [`integration-channel-${key}-effect`, options.effectState ?? 'authorized'],
    );
    const row = await pool.query<{ id: string }>(
      `INSERT INTO channel_outbox(channel,recipient_ref,message_kind,redacted_payload,idempotency_key,effect_intent_id,status,attempts,max_attempts,lease_expires_at)
       VALUES('telegram','123456','approval_required','{"text":"Integration notice"}',$1,$2,$3,$4,$5,
         CASE WHEN $6 THEN now()-interval '1 minute' ELSE NULL END) RETURNING id`,
      [`integration-channel-${key}-outbox`, effect.rows[0].id, options.status ?? 'pending', options.attempts ?? 0, options.maxAttempts ?? 3, options.stale ?? false],
    );
    return { effectId: effect.rows[0].id, outboxId: row.rows[0].id };
  }

  const deniedFixture = await createOutboxFixture('controls');
  assert.deepEqual(await channelOutbox.claim(), { claimed: false, reason: 'commercial_lock' });
  await pool.query('UPDATE system_controls SET commercial_lock=false,paused=true WHERE singleton=true');
  assert.deepEqual(await channelOutbox.claim(), { claimed: false, reason: 'system_paused' });
  await pool.query('UPDATE system_controls SET paused=false,killed=true WHERE singleton=true');
  assert.deepEqual(await channelOutbox.claim(), { claimed: false, reason: 'system_killed' });
  assert.equal((await pool.query('SELECT attempts FROM channel_outbox WHERE id=$1', [deniedFixture.outboxId])).rows[0].attempts, 0);
  await pool.query("UPDATE channel_outbox SET status='cancelled',updated_at=now() WHERE id=$1", [deniedFixture.outboxId]);
  await pool.query("UPDATE effect_intents SET state='cancelled',updated_at=now() WHERE id=$1", [deniedFixture.effectId]);
  await pool.query('UPDATE system_controls SET killed=false,paused=false,commercial_lock=false WHERE singleton=true');

  await createOutboxFixture('concurrent');
  const concurrentClaims = await Promise.all([channelOutbox.claim(), channelOutbox.claim()]);
  assert.equal(concurrentClaims.filter((claim) => claim.claimed).length, 1);
  assert.equal(concurrentClaims.filter((claim) => !claim.claimed && claim.reason === 'empty').length, 1);
  const concurrentDelivery = concurrentClaims.find((claim) => claim.claimed)!.delivery!;
  await channelOutbox.recordResult(concurrentDelivery.id, concurrentDelivery.attempt, { outcome: 'ambiguous', error: 'timeout_after_submit' });
  assert.deepEqual(await channelOutbox.claim(), { claimed: false, reason: 'empty' });
  assert.deepEqual((await pool.query(
    `SELECT o.status,e.state AS effect_state FROM channel_outbox o
     JOIN effect_intents e ON e.id=o.effect_intent_id WHERE o.id=$1`,
    [concurrentDelivery.id],
  )).rows[0], { status: 'reconciliation_required', effect_state: 'reconciliation_required' });

  await createOutboxFixture('retry-cap', { maxAttempts: 2 });
  const retryOne = (await channelOutbox.claim()).delivery!;
  assert.deepEqual(await channelOutbox.recordResult(retryOne.id, 1, { outcome: 'failed', error: 'provider_rejected' }), {
    id: retryOne.id, status: 'pending', retry: true,
  });
  await pool.query("UPDATE channel_outbox SET next_attempt_at=now() WHERE id=$1", [retryOne.id]);
  const retryTwo = (await channelOutbox.claim()).delivery!;
  assert.equal(retryTwo.attempt, 2);
  assert.deepEqual(await channelOutbox.recordResult(retryTwo.id, 2, { outcome: 'failed', error: 'provider_rejected' }), {
    id: retryTwo.id, status: 'failed', retry: false,
  });
  assert.deepEqual((await pool.query(
    `SELECT o.status,e.state AS effect_state FROM channel_outbox o
     JOIN effect_intents e ON e.id=o.effect_intent_id WHERE o.id=$1`,
    [retryTwo.id],
  )).rows[0], { status: 'failed', effect_state: 'failed' });

  const staleFixture = await createOutboxFixture('stale', { effectState: 'executing', status: 'delivering', attempts: 1, stale: true });
  assert.deepEqual(await channelOutbox.claim(), { claimed: false, reason: 'empty' });
  assert.deepEqual((await pool.query(
    `SELECT o.status,e.state AS effect_state FROM channel_outbox o
     JOIN effect_intents e ON e.id=o.effect_intent_id WHERE o.id=$1`,
    [staleFixture.outboxId],
  )).rows[0], { status: 'reconciliation_required', effect_state: 'reconciliation_required' });
  await pool.query('UPDATE system_controls SET commercial_lock=true WHERE singleton=true');

  const objective = await pool.query<{ id: string }>("INSERT INTO objectives(statement,status) VALUES('integration fixture','active') RETURNING id");
  const opening = await pool.query<{ contributions: string; fixed_expense: string; revenue: string; cash: string }>(
    `SELECT
       COALESCE(SUM(gross_minor) FILTER(WHERE entry_type='contribution' AND payment_status='settled'),0) AS contributions,
       COALESCE(SUM(gross_minor) FILTER(WHERE category='fixed_infrastructure_historical' AND payment_status='settled'),0) AS fixed_expense,
       COALESCE(SUM(net_minor) FILTER(WHERE entry_type='revenue' AND payment_status='settled'),0) AS revenue,
       COALESCE(SUM(net_minor) FILTER(WHERE entry_type IN ('contribution','revenue') AND payment_status='settled'),0)
         - COALESCE(SUM(gross_minor) FILTER(WHERE entry_type IN ('expense','refund') AND payment_status='settled'),0) AS cash
     FROM ledger_entries WHERE currency='INR'`,
  );
  assert.deepEqual(opening.rows[0], { contributions: '500000', fixed_expense: '200000', revenue: '0', cash: '300000' });
  const authority = await pool.query<{ released: string; reserve: string }>(
    "SELECT released_operating_minor::text AS released,required_reserve_minor::text AS reserve FROM financial_policy_state WHERE currency='INR'",
  );
  assert.deepEqual(authority.rows[0], { released: '0', reserve: '200000' });
  const ticketService = new TicketService(pool);
  const ticket = await ticketService.create({
    title: 'Persisted ticket integration fixture',
    objectiveId: objective.rows[0].id,
    status: 'ready',
    priority: 7,
    acceptanceCriteria: 'ticket, audit, and activity are persisted',
  }, { type: 'agent', id: 'integration-agent' });
  await ticketService.transition(ticket.id, 'validation', { type: 'agent', id: 'integration-agent' }, { verificationEvidence: 'postgres query verified' });
  await ticketService.update(ticket.id, { title: 'Persisted ticket edited fixture', priority: 9, actualEffortMinutes: 12 }, { type: 'agent', id: 'integration-agent' });
  const editedTicket = await pool.query<{ title: string; priority: number; actual_effort_minutes: number }>('SELECT title,priority,actual_effort_minutes FROM tasks WHERE id=$1', [ticket.id]);
  assert.deepEqual(editedTicket.rows[0], { title: 'Persisted ticket edited fixture', priority: 9, actual_effort_minutes: 12 });

  const persistedTicket = await pool.query<{ status: string; verification_evidence: string }>('SELECT status,verification_evidence FROM tasks WHERE id=$1', [ticket.id]);
  assert.deepEqual(persistedTicket.rows[0], { status: 'validation', verification_evidence: 'postgres query verified' });
  const page = await listTickets({ status: 'validation', search: 'Persisted ticket', limit: 10, offset: 0 });
  assert.equal(page.total, 1); assert.equal(page.items[0].id, ticket.id);
  const detailedTicket = await ticketDetail(ticket.id);
  assert.equal(detailedTicket?.id, ticket.id); assert.equal(detailedTicket?.activity.length, 3);
  const ticketActivity = await pool.query<{ count: string }>("SELECT count(*) FROM activity_events WHERE task_id=$1 AND event_type IN ('ticket_created','ticket_transitioned')", [ticket.id]);
  const ticketAudit = await pool.query<{ count: string }>("SELECT count(*) FROM audit_events WHERE entity_id=$1 AND event_type IN ('ticket_created','ticket_transitioned')", [ticket.id]);
  assert.equal(ticketActivity.rows[0].count, '2');
  assert.equal(ticketAudit.rows[0].count, '2');

  const approvalRequestService = new ApprovalRequestService(pool);
  const requested = await approvalRequestService.request({ actionType: 'expense', requestedAction: 'integration request', reason: 'verify durable approval', risk: 'none', recommendation: 'reject', idempotencyKey: 'integration-request-1', expiresAt: '2099-01-01T00:00:00.000Z', alternatives: ['no action'], evidence: [{ uri: 'artifact://integration' }], ticketId: ticket.id }, { type: 'agent', id: 'integration-agent' });
  assert.equal(requested.duplicate, false);
  const duplicateRequest = await approvalRequestService.request({ actionType: 'expense', requestedAction: 'integration request', reason: 'verify durable approval', risk: 'none', recommendation: 'reject', idempotencyKey: 'integration-request-1', expiresAt: '2099-01-01T00:00:00.000Z', alternatives: ['no action'], evidence: [{ uri: 'artifact://integration' }], ticketId: ticket.id }, { type: 'agent', id: 'integration-agent' });
  assert.equal(duplicateRequest.duplicate, true);
  const requestHistory = await pool.query<{ count: string }>("SELECT count(*) FROM approval_events");
  assert.equal(requestHistory.rows[0].count, '2');
  const approval = await pool.query<{ id: string }>("INSERT INTO approvals(action_type,requested_action,reason,risk,recommendation,idempotency_key,expires_at) VALUES('expense','test approval','integration coverage','none','reject unsafe actions','integration-approval-1',now()+interval '1 hour') RETURNING id");
  const approvalService = new ApprovalService(pool);
  await approvalService.transition(approval.rows[0].id, 'reject', { type: 'owner', id: 'integration-owner' }, 'rejected in integration test');
  const persistedApproval = await pool.query<{ status: string; decided_by: string }>('SELECT status,decided_by FROM approvals WHERE id=$1', [approval.rows[0].id]);
  assert.deepEqual(persistedApproval.rows[0], { status: 'rejected', decided_by: 'integration-owner' });
  const approvalEvents = await pool.query<{ count: string }>('SELECT count(*) FROM approval_events WHERE approval_id=$1 AND action=$2', [approval.rows[0].id, 'rejected']);
  assert.equal(approvalEvents.rows[0].count, '1');
  const detailedApproval = await approvalDetail(approval.rows[0].id);
  assert.equal(detailedApproval?.id, approval.rows[0].id); assert.equal(detailedApproval?.events.length, 1);
  await assert.rejects(approvalService.transition(approval.rows[0].id, 'approve', { type: 'agent', id: 'integration-agent' }), (error: unknown) => error instanceof ApprovalTransitionError && error.reason === 'invalid_actor');

  const immutable = await pool.query<{ id: string }>("INSERT INTO ledger_entries(transaction_id,entry_type,currency,gross_minor,net_minor,counterparty,payment_status,idempotency_key,ticket_id) VALUES('integration-ledger-1','contribution','INR',100,100,'owner','settled','integration-ledger-1',$1) RETURNING id", [ticket.id]);
  await assert.rejects(pool.query('UPDATE ledger_entries SET counterparty=$2 WHERE id=$1', [immutable.rows[0].id, 'changed']), /append-only table/);

  const ledgerPage = await listLedgerEntries({ status: 'settled', search: 'integration-ledger', limit: 5, offset: 0 });
  assert.equal(ledgerPage.total, 1); assert.equal(ledgerPage.items[0].id, immutable.rows[0].id);
  const ledgerRecord = await ledgerDetail(immutable.rows[0].id);
  assert.equal(ledgerRecord?.transaction_id, 'integration-ledger-1'); assert.equal(ledgerRecord?.ticket_title, 'Persisted ticket edited fixture');

  const approvalPage = await listApprovals({ status: 'pending', search: 'integration request', limit: 5, offset: 0 });
  assert.equal(approvalPage.total, 1); assert.equal(approvalPage.items[0].ticket_id, ticket.id);

  const job = await pool.query<{ id: string }>("INSERT INTO jobs(name,purpose,action_kind,idempotency_key,status,related_ticket_id) VALUES('integration job','prove job browser records','job','integration-job-1','queued',$1) RETURNING id", [ticket.id]);
  const run = await pool.query<{ id: string }>("INSERT INTO job_runs(job_id,status,attempt,worker_id,output) VALUES($1,'completed',1,'integration-worker',$2) RETURNING id", [job.rows[0].id, JSON.stringify({ ok: true })]);
  await pool.query("INSERT INTO job_logs(run_id,level,message,payload) VALUES($1,'info','integration log',$2)", [run.rows[0].id, JSON.stringify({ source: 'integration' })]);
  const jobPage = await listJobs({ status: 'queued', search: 'integration job', limit: 5, offset: 0 });
  assert.equal(jobPage.total, 1); assert.equal(jobPage.items[0].id, job.rows[0].id);
  const jobRecord = await jobDetail(job.rows[0].id);
  assert.equal(jobRecord?.runs.length, 1); assert.equal(jobRecord?.logs.length, 1);

  const claimed = await claimNextJob('integration-supervisor');
  assert.equal(claimed?.job.id, job.rows[0].id);
  assert.equal(await executeInternalJob(claimed!), 'completed');
  const duplicateEffect = await pool.query<{ count: string }>('SELECT count(*) FROM job_effects WHERE job_id=$1', [job.rows[0].id]);
  assert.equal(duplicateEffect.rows[0].count, '1');

  const abandoned = await pool.query<{ id: string }>(
    `INSERT INTO jobs(name,purpose,action_kind,idempotency_key,status,attempts,max_attempts,lease_until,claimed_by)
     VALUES('abandoned integration job','prove restart recovery','job','integration-abandoned-1','running',1,3,now()-interval '1 minute','dead-worker') RETURNING id`,
  );
  await pool.query("INSERT INTO job_runs(job_id,status,attempt,worker_id) VALUES($1,'running',1,'dead-worker')", [abandoned.rows[0].id]);
  assert.equal(await recoverAbandonedJobs(), 1);
  const recovered = await pool.query<{ status: string; last_error: string }>('SELECT status,last_error FROM jobs WHERE id=$1', [abandoned.rows[0].id]);
  assert.deepEqual(recovered.rows[0], { status: 'queued', last_error: 'recovered_after_restart' });

  const internalClient = await pool.connect();
  try {
    await internalClient.query('BEGIN');
    const first = await authorizeEffect(internalClient, {
      idempotencyKey: 'integration-effect-internal-1', kind: 'internal', jobId: job.rows[0].id,
    }, actorContext({ actorType: 'worker', actorId: 'integration-supervisor', credentialScope: 'effects:internal', originPlatform: 'supervisor' }));
    const repeated = await authorizeEffect(internalClient, {
      idempotencyKey: 'integration-effect-internal-1', kind: 'internal', jobId: job.rows[0].id,
    }, actorContext({ actorType: 'worker', actorId: 'integration-supervisor', credentialScope: 'effects:internal', originPlatform: 'supervisor' }));
    assert.equal(first.duplicate, false); assert.equal(repeated.duplicate, true);
    await internalClient.query('COMMIT');
  } finally { internalClient.release(); }

  const externalClient = await pool.connect();
  try {
    await externalClient.query('BEGIN');
    const denied = await authorizeEffect(externalClient, { idempotencyKey: 'integration-effect-message-denied', kind: 'message' },
      actorContext({ actorType: 'agent', actorId: 'integration-agent', credentialScope: 'effects:message', originPlatform: 'mcp' }));
    assert.equal(denied.state, 'denied');
    assert.equal(denied.policyCode, 'commercial_lock');
    await externalClient.query('COMMIT');
  } finally { externalClient.release(); }

  const trancheApproval = await pool.query<{ id: string }>(
    `INSERT INTO approvals(action_type,requested_action,reason,cost_minor,currency,risk,recommendation,idempotency_key,status,expires_at,decided_at,decided_by)
     VALUES('tranche_release','release integration tranche','prove audited release',50000,'INR','bounded','release after P0','integration-tranche-release','approved',now()+interval '1 hour',now(),'integration-owner') RETURNING id`,
  );
  await assert.rejects(
    releaseOperatingTranche(pool, trancheApproval.rows[0].id, { type: 'system', id: 'integration-reconciler' }),
    (error: unknown) => error instanceof Error && error.message === 'p0_gate_incomplete',
  );
  await pool.query("UPDATE readiness_gates SET status='PASS',verified_at=now(),evidence_uri='integration://p0' WHERE priority='P0'");
  const released = await releaseOperatingTranche(pool, trancheApproval.rows[0].id, { type: 'system', id: 'integration-reconciler' });
  assert.equal(released.amountMinor, 50000);
  assert.equal(released.releasedOperatingMinor, 50000);
  assert.equal(released.commercialLock, false);
  assert.equal(released.duplicate, false);
  const repeatedRelease = await releaseOperatingTranche(pool, trancheApproval.rows[0].id, { type: 'system', id: 'integration-reconciler' });
  assert.equal(repeatedRelease.id, released.id);
  assert.equal(repeatedRelease.duplicate, true);
  assert.deepEqual((await pool.query(
    'SELECT released_operating_minor::text AS released FROM financial_policy_state WHERE currency=$1',
    ['INR'],
  )).rows[0], { released: '50000' });
  assert.deepEqual((await pool.query(
    'SELECT commercial_lock FROM system_controls WHERE singleton=true',
  )).rows[0], { commercial_lock: false });
  assert.equal((await pool.query(
    "SELECT count(*) FROM audit_events WHERE event_type='operating_tranche_released' AND entity_id=$1",
    [released.id],
  )).rows[0].count, '1');
  await assert.rejects(
    pool.query('UPDATE operating_tranche_releases SET actor_id=$2 WHERE id=$1', [released.id, 'changed']),
    /append-only table/,
  );

  const spendVenture = await pool.query<{ id: string }>(
    `INSERT INTO ventures(name,thesis,target_user,problem,offer,revenue_model,distribution_strategy)
     VALUES('Tranche spend fixture','prove controlled spend','test','historical costs must not consume new authority','test','internal','none') RETURNING id`,
  );
  const spendExperiment = await pool.query<{ id: string }>(
    `INSERT INTO experiments(venture_id,hypothesis,target_customer,method,success_metric,failure_metric)
     VALUES($1,'released authority works','test','append one controlled expense','expense persists','expense denied') RETURNING id`,
    [spendVenture.rows[0].id],
  );
  const expenseApproval = await pool.query<{ id: string }>(
    `INSERT INTO approvals(action_type,requested_action,reason,cost_minor,currency,risk,recommendation,idempotency_key,status,expires_at,decided_at,decided_by)
     VALUES('expense','integration expense','prove historical fixed cost does not consume released authority',1000,'INR','bounded','approve fixture','integration-expense-approval','approved',now()+interval '1 hour',now(),'integration-owner') RETURNING id`,
  );
  const ledger = new LedgerService(pool, { singleLimitMinor: 30000, dailyLimitMinor: 80000, experimentLimitMinor: 100000 });
  const controlledExpense = await ledger.append({
    transactionId: 'integration-controlled-expense',
    entryType: 'expense',
    currency: 'INR',
    grossMinor: 1000,
    netMinor: 1000,
    counterparty: 'integration fixture',
    ventureId: spendVenture.rows[0].id,
    experimentId: spendExperiment.rows[0].id,
    paymentStatus: 'settled',
    evidenceUri: 'integration://controlled-expense',
    idempotencyKey: 'integration-controlled-expense',
  }, {
    approvalId: expenseApproval.rows[0].id,
    actorId: 'integration-agent',
    justification: {
      category: 'integration_test',
      objective: 'prove released authority',
      expectedResult: 'one append-only expense',
      evidenceUri: 'integration://controlled-expense',
      alternatives: ['no-op fixture'],
      worstCaseLoss: '1000 minor units',
      successCondition: 'ledger insert succeeds',
      stopCondition: 'any policy denial',
      expectedPayback: 'not applicable test fixture',
      confidence: 100,
    },
  });
  assert.equal(controlledExpense.duplicate, false);

  const messageApproval = await pool.query<{ id: string }>(
    `INSERT INTO approvals(action_type,requested_action,reason,risk,recommendation,idempotency_key,status,expires_at,decided_at,decided_by)
     VALUES('external_outreach','integration message','effect state test','low','approve test only','integration-message-approval','approved',now()+interval '1 hour',now(),'integration-owner') RETURNING id`,
  );

  const marketplaceApproval = await pool.query<{ id: string }>(
    `INSERT INTO approvals(action_type,requested_action,reason,risk,recommendation,idempotency_key,status,expires_at,decided_at,decided_by)
     VALUES('marketplace_bounty_claim_and_submission','claim one marketplace bounty','effect scope test','bounded external work','approve exact test job only','integration-marketplace-approval','approved',now()+interval '1 hour',now(),'integration-owner') RETURNING id`,
  );
  const marketplaceClient = await pool.connect();
  try {
    await marketplaceClient.query('BEGIN');
    const marketplaceEffect = await authorizeEffect(marketplaceClient, {
      idempotencyKey: 'integration-marketplace-effect-1',
      kind: 'account_change',
      approvalId: marketplaceApproval.rows[0].id,
      payload: { provider: 'test_marketplace', operation: 'claim_and_submit', job_id: 'exact-test-job' },
    }, actorContext({ actorType: 'agent', actorId: 'integration-agent', credentialScope: 'effects:account_change', originPlatform: 'api' }));
    assert.equal(marketplaceEffect.state, 'authorized');
    await marketplaceClient.query('ROLLBACK');
  } finally { marketplaceClient.release(); }

  const ambiguousClient = await pool.connect();
  try {
    await ambiguousClient.query('BEGIN');
    const authorized = await authorizeEffect(ambiguousClient, {
      idempotencyKey: 'integration-effect-message-1', kind: 'message', approvalId: messageApproval.rows[0].id,
    }, actorContext({ actorType: 'worker', actorId: 'integration-supervisor', credentialScope: 'effects:message', originPlatform: 'relay' }));
    assert.equal(await claimAuthorizedEffect(ambiguousClient, authorized.id, 'message'), true);
    assert.equal(await claimAuthorizedEffect(ambiguousClient, authorized.id, 'message'), false);
    assert.equal(await recordExternalResult(ambiguousClient, authorized.id, { outcome: 'ambiguous', error: 'timeout_after_call' }), 'reconciliation_required');
    await ambiguousClient.query('COMMIT');
  } finally { ambiguousClient.release(); }
  const ambiguous = await pool.query<{ state: string; provider_idempotency_key: string }>(
    "SELECT state,provider_idempotency_key FROM effect_intents WHERE idempotency_key='integration-effect-message-1'",
  );
  assert.deepEqual(ambiguous.rows[0], { state: 'reconciliation_required', provider_idempotency_key: 'integration-effect-message-1' });

  const commercial = new CommercialOperationsService(pool);
  const product = await commercial.createProduct({
    name: 'Integration conversion audit', description: 'Fixed-scope reliability and conversion review',
    target_customer: 'Small ecommerce operators', status: 'active', pricing_model: 'one_time',
    price_minor: 250000, currency: 'INR',
  }, { type: 'agent', id: 'integration-agent' });
  const prospect = await commercial.createProspect({
    source: 'integration research', qualification: 'Public buyer with a verified conversion problem',
    display_name: 'Integration Prospect', organization: 'Fixture Commerce', pipeline_stage: 'qualified',
    qualification_score: 84, estimated_value_minor: 250000, currency: 'INR',
    contact_channel: 'email', contact_endpoint: 'buyer@example.test', product_id: product.id,
    next_action: 'Review a tailored outline', next_action_at: '2099-01-01T00:00:00.000Z',
  }, { type: 'agent', id: 'integration-agent' });
  assert.equal(prospect.contact_endpoint, undefined);
  assert.equal(prospect.contact_endpoint_masked, 'bu***@example.test');
  const followUp = await commercial.createActivity({
    lead_id: prospect.id, product_id: product.id, activity_type: 'follow_up',
    title: 'Review reply', status: 'scheduled', due_at: '2099-01-02T00:00:00.000Z', recurrence: 'weekly',
  }, { type: 'agent', id: 'integration-agent' });
  const completedFollowUp = await commercial.updateActivity(followUp.id, { status: 'completed' }, { type: 'agent', id: 'integration-agent' });
  assert.ok(completedFollowUp.next_activity_id);
  const duplicateCompletion = await commercial.updateActivity(followUp.id, { status: 'completed' }, { type: 'agent', id: 'integration-agent' });
  assert.equal(duplicateCompletion.next_activity_id, completedFollowUp.next_activity_id);
  assert.equal(duplicateCompletion.duplicate, true);
  const authorizedMessage = await pool.query<{ id: string }>(
    "SELECT id FROM effect_intents WHERE idempotency_key='integration-effect-message-1'",
  );
  const outbound = await commercial.recordMessage({
    lead_id: prospect.id, product_id: product.id, direction: 'outbound', channel: 'email',
    subject: 'Tailored reliability outline', content_preview: 'A short, redacted preview',
    provider_reference: 'integration-provider-message-1', effect_intent_id: authorizedMessage.rows[0].id,
    approval_id: messageApproval.rows[0].id,
  }, { type: 'agent', id: 'integration-agent' });
  await commercial.recordMessageEvent(outbound.id, {
    event_type: 'delivered', provider_event_id: 'integration-provider-event-1',
    evidence: { api_token: 'must-not-persist', provider: { response: 'accepted' } },
  }, { type: 'worker', id: 'integration-webhook' });
  const storedEventEvidence = (await pool.query<{ evidence: Record<string, unknown> }>(
    "SELECT evidence FROM commercial_message_events WHERE provider_event_id='integration-provider-event-1'",
  )).rows[0].evidence;
  assert.equal(storedEventEvidence.api_token, '[REDACTED]');
  assert.deepEqual(storedEventEvidence.provider, { response: 'accepted' });
  assert.equal((await commercial.recordMessageEvent(outbound.id, {
    event_type: 'delivered', provider_event_id: 'integration-provider-event-1',
  }, { type: 'worker', id: 'integration-webhook' }) as any).duplicate, true);
  await commercial.recordMessageEvent(outbound.id, {
    event_type: 'replied', provider_event_id: 'integration-provider-event-2',
  }, { type: 'worker', id: 'integration-inbox' });
  const prospectPage = await commercial.listProspects({ stage: 'qualified', search: 'Fixture Commerce' });
  assert.equal(prospectPage.total, 1);
  assert.equal(prospectPage.items[0].contact_endpoint, undefined);
  const productPage = await commercial.listProducts({ status: 'active', search: 'conversion audit' });
  assert.equal(productPage.total, 1);
  const messagePage = await commercial.listMessages({ status: 'replied', search: 'Integration Prospect' });
  assert.equal(messagePage.total, 1);
  assert.equal(messagePage.items[0].effect_intent_id, authorizedMessage.rows[0].id);
  const commercialActivitiesPage = await commercial.listActivities({ status: 'scheduled', search: 'Review reply' });
  assert.equal(commercialActivitiesPage.total, 1);
  const commercialOverview = await commercial.overview();
  assert.equal(commercialOverview.messages.sent, 1);
  assert.equal(commercialOverview.messages.replied, 1);
  assert.equal(commercialOverview.activities.recurring, 1);
  const commercialDetail = await commercial.prospectDetail(prospect.id);
  assert.equal(commercialDetail?.messages[0].latest_status, 'replied');
  await assert.rejects(
    commercial.recordMessage({
      lead_id: prospect.id, direction: 'outbound', channel: 'email', subject: 'Unsafe bypass',
    }, { type: 'agent', id: 'integration-agent' }),
    /effect_linkage_required/,
  );
  await assert.rejects(
    commercial.createProspect({
      source: 'integration research', qualification: 'Invalid channel fixture',
      contact_channel: 'carrier_pigeon',
    }, { type: 'agent', id: 'integration-agent' }),
    /invalid_contact_channel/,
  );
  await assert.rejects(pool.query('UPDATE commercial_messages SET subject=$2 WHERE id=$1', [outbound.id, 'changed']), /append-only table/);
  await assert.rejects(
    pool.query(
      `INSERT INTO commercial_messages(lead_id,direction,channel,effect_intent_id,approval_id,recorded_by)
       VALUES($1,'outbound','email',$2,$3,'direct-bypass')`,
      [prospect.id, authorizedMessage.rows[0].id, approval.rows[0].id],
    ),
    /executed message effect required/,
  );
  assert.equal(Number((await pool.query(
    "SELECT count(*) FROM audit_events WHERE entity_id IN ($1,$2,$3) AND event_type LIKE 'commercial_%'",
    [product.id, prospect.id, outbound.id],
  )).rows[0].count) >= 3, true);

  await pool.query("INSERT INTO system_health_checks(component,status,detail) VALUES('integration-db','ok','fresh migration verified')");
  const healthPage = await listHealthChecks({ status: 'ok', search: 'integration-db', limit: 5, offset: 0 });
  assert.equal(healthPage.total, 1); assert.equal(healthPage.items[0].component, 'integration-db');

  await pool.query("INSERT INTO incidents(severity,status,summary) VALUES('low','open','integration incident fixture')");
  const incidentPage = await listIncidents({ status: 'open', search: 'integration incident', limit: 5, offset: 0 });
  assert.equal(incidentPage.total, 1); assert.equal(incidentPage.items[0].summary, 'integration incident fixture');

  const activityPage = await listActivity({ search: 'ticket', limit: 10, offset: 0 });
  assert.equal(activityPage.total >= 3, true);

  const venture = await createEntity('ventures', {
    name: 'P0 domain CRUD fixture', thesis: 'prove create and update', target_user: 'owner',
    problem: 'unverified domain workflow', offer: 'durable records', revenue_model: 'internal',
    distribution_strategy: 'none',
  }, 'integration-owner');
  const updatedVenture = await updateEntity('ventures', venture.id, { next_milestone: 'verified' }, 'integration-owner');
  assert.equal(updatedVenture.next_milestone, 'verified');
  assert.equal((await pool.query("SELECT count(*) FROM audit_events WHERE entity_id=$1 AND event_type IN ('ventures_created','ventures_updated')", [venture.id])).rows[0].count, '2');

  // Direct database writes still receive an immutable audit backstop.
  const directVenture = await pool.query<{ id: string }>(
    `INSERT INTO ventures(name,thesis,target_user,problem,offer,revenue_model,distribution_strategy)
     VALUES('P0 audit fixture','test','test','test','test','test','test') RETURNING id`,
  );
  assert.equal((await pool.query(
    "SELECT count(*) FROM audit_events WHERE event_type='ventures_insert' AND entity_id=$1",
    [directVenture.rows[0].id],
  )).rows[0].count, '1');
  await assert.rejects(pool.query('UPDATE audit_events SET payload=$1 WHERE entity_id=$2', ['{}', directVenture.rows[0].id]), /append-only table/);

  // PostgreSQL rejects charge records that bypass required commercial metadata.
  await assert.rejects(
    pool.query(
      `INSERT INTO ledger_entries(transaction_id,entry_type,currency,gross_minor,net_minor,counterparty,payment_status,idempotency_key)
       VALUES('invalid-expense-bypass','expense','INR',1,1,'fixture','settled','invalid-expense-bypass')`,
    ),
    /expense metadata required/,
  );

  const ownerSession = await createOwnerSession('127.0.0.1');
  assert.ok(await getOwnerSession(ownerSession.value));
  await revokeOwnerSession(ownerSession.value);
  assert.equal(await getOwnerSession(ownerSession.value), null);
  assert.equal(Number((await pool.query(
    "SELECT count(*) FROM audit_events WHERE entity_type='owner_sessions' AND event_type IN ('owner_sessions_insert','owner_sessions_update')",
  )).rows[0].count) >= 2, true);

  // Telegram uses the same transactional pause/kill boundary as the dashboard.
  const controlJob = await pool.query<{ id: string }>(
    "INSERT INTO jobs(name,purpose,idempotency_key,status) VALUES('control fixture','pause immediately','control-fixture','queued') RETURNING id",
  );
  const telegram = new TelegramControlService(pool, new Set(['42']));
  assert.equal((await telegram.handle('41', '/pause confirm') as any).reason, 'unauthorized_user');
  assert.equal(Array.isArray((await telegram.handle('42', '/balance') as any).finance), true);
  assert.equal((await telegram.handle('42', '/pause') as any).confirmation_required, true);
  assert.equal((await telegram.handle('42', '/pause confirm') as any).controls.paused, true);
  assert.equal((await pool.query('SELECT status FROM jobs WHERE id=$1', [controlJob.rows[0].id])).rows[0].status, 'paused');
  assert.equal((await telegram.handle('42', '/resume confirm') as any).controls.paused, false);

  const killJob = await pool.query<{ id: string }>(
    "INSERT INTO jobs(name,purpose,idempotency_key,status) VALUES('kill fixture','kill immediately','kill-fixture','queued') RETURNING id",
  );
  const killClient = await pool.connect();
  let cancellableEffect = '';
  try {
    await killClient.query('BEGIN');
    const approval = await killClient.query<{ id: string }>(
      `INSERT INTO approvals(action_type,requested_action,reason,risk,recommendation,idempotency_key,status,expires_at,decided_at,decided_by)
       VALUES('message','cancel on kill','P0 fixture','none','test','kill-effect-approval','approved',now()+interval '1 hour',now(),'integration-owner') RETURNING id`,
    );
    const intent = await authorizeEffect(killClient, { idempotencyKey: 'kill-effect', kind: 'message', approvalId: approval.rows[0].id },
      actorContext({ actorType: 'worker', actorId: 'integration-supervisor', credentialScope: 'effects:message', originPlatform: 'integration' }));
    cancellableEffect = intent.id;
    await killClient.query('COMMIT');
  } catch (error) {
    await killClient.query('ROLLBACK'); throw error;
  } finally {
    killClient.release();
  }
  const killed = await applySystemControl(pool, 'kill', 'owner', 'integration-owner') as any;
  assert.equal(killed.killed, true); assert.equal(killed.paused, true);
  assert.equal((await pool.query('SELECT state FROM effect_intents WHERE id=$1', [cancellableEffect])).rows[0].state, 'cancelled');
  assert.equal((await pool.query('SELECT status FROM jobs WHERE id=$1', [killJob.rows[0].id])).rows[0].status, 'paused');
  assert.equal((await pool.query("SELECT count(*) FROM audit_events WHERE event_type='control_kill'")).rows[0].count, '1');
});
