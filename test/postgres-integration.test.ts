import test from 'node:test';
import assert from 'node:assert/strict';

const enabled = process.env.RUN_POSTGRES_INTEGRATION === 'true';

test('PostgreSQL integration prerequisites are explicit', { skip: !enabled }, async () => {
  const { pool } = await import('../src/db.ts');
  const { TicketService } = await import('../src/tickets.ts');
  const { ApprovalService, ApprovalTransitionError } = await import('../src/approvals.ts');
  const { ApprovalRequestService } = await import('../src/approval-requests.ts');
  const { authorizeEffect, markExternalExecuting, recordExternalResult, EffectPolicyError } = await import('../src/effects.ts');
  const { actorContext } = await import('../src/actor.ts');
  const { claimNextJob, executeInternalJob, recoverAbandonedJobs } = await import('../src/jobs.ts');
  const { approvalDetail, jobDetail, ledgerDetail, listActivity, listApprovals, listHealthChecks, listIncidents, listJobs, listLedgerEntries, listTickets, ticketDetail } = await import('../src/records.ts');

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

  const messageApproval = await pool.query<{ id: string }>(
    `INSERT INTO approvals(action_type,requested_action,reason,risk,recommendation,idempotency_key,status,expires_at,decided_at,decided_by)
     VALUES('message','integration message','effect state test','low','approve test only','integration-message-approval','approved',now()+interval '1 hour',now(),'integration-owner') RETURNING id`,
  );
  const ambiguousClient = await pool.connect();
  try {
    await ambiguousClient.query('BEGIN');
    await ambiguousClient.query('UPDATE system_controls SET commercial_lock=false WHERE singleton=true');
    const authorized = await authorizeEffect(ambiguousClient, {
      idempotencyKey: 'integration-effect-message-1', kind: 'message', approvalId: messageApproval.rows[0].id,
    }, actorContext({ actorType: 'worker', actorId: 'integration-supervisor', credentialScope: 'effects:message', originPlatform: 'relay' }));
    await markExternalExecuting(ambiguousClient, authorized.id);
    assert.equal(await recordExternalResult(ambiguousClient, authorized.id, { outcome: 'ambiguous', error: 'timeout_after_call' }), 'reconciliation_required');
    await ambiguousClient.query('UPDATE system_controls SET commercial_lock=true WHERE singleton=true');
    await ambiguousClient.query('COMMIT');
  } finally { ambiguousClient.release(); }
  const ambiguous = await pool.query<{ state: string; provider_idempotency_key: string }>(
    "SELECT state,provider_idempotency_key FROM effect_intents WHERE idempotency_key='integration-effect-message-1'",
  );
  assert.deepEqual(ambiguous.rows[0], { state: 'reconciliation_required', provider_idempotency_key: 'integration-effect-message-1' });

  await pool.query("INSERT INTO system_health_checks(component,status,detail) VALUES('integration-db','ok','fresh migration verified')");
  const healthPage = await listHealthChecks({ status: 'ok', search: 'integration-db', limit: 5, offset: 0 });
  assert.equal(healthPage.total, 1); assert.equal(healthPage.items[0].component, 'integration-db');

  await pool.query("INSERT INTO incidents(severity,status,summary) VALUES('low','open','integration incident fixture')");
  const incidentPage = await listIncidents({ status: 'open', search: 'integration incident', limit: 5, offset: 0 });
  assert.equal(incidentPage.total, 1); assert.equal(incidentPage.items[0].summary, 'integration incident fixture');

  const activityPage = await listActivity({ search: 'ticket', limit: 10, offset: 0 });
  assert.equal(activityPage.total >= 3, true);
});
