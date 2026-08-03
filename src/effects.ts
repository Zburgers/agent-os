import type { PoolClient } from 'pg';
import { hasScope, type ActorContext } from './actor.ts';

export type EffectKind = 'internal' | 'message' | 'expense' | 'deployment' | 'payment' | 'account_change' | 'purchase';
export type EffectState = 'proposed' | 'denied' | 'authorized' | 'executing' | 'succeeded' | 'failed' | 'reconciliation_required' | 'cancelled';
export class EffectPolicyError extends Error {
  readonly code: string;
  constructor(code: string) { super(code); this.code = code; }
}

const externalKinds = new Set<EffectKind>(['message', 'expense', 'deployment', 'payment', 'account_change', 'purchase']);
const approvalActionTypes: Record<Exclude<EffectKind, 'internal'>, string[]> = {
  message: ['message', 'external_outreach'],
  expense: ['expense'],
  deployment: ['deployment', 'public_service_deployment'],
  payment: ['payment'],
  account_change: ['account_change', 'commercial_account_creation', 'marketplace_bounty_claim_and_submission', 'marketplace_worker_bids'],
  purchase: ['expense'],
};

export function approvalActionTypesForEffect(kind: Exclude<EffectKind, 'internal'>): readonly string[] {
  return approvalActionTypes[kind];
}

export async function authorizeEffect(
  client: PoolClient,
  input: { idempotencyKey: string; kind: EffectKind; jobId?: string; runId?: string; approvalId?: string; payload?: Record<string, unknown> },
  actor: ActorContext,
) {
  if (!input.idempotencyKey.trim()) throw new EffectPolicyError('invalid_idempotency_key');
  await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [input.idempotencyKey]);
  const duplicate = await client.query<{ id: string; state: EffectState }>(
    'SELECT id,state FROM effect_intents WHERE idempotency_key=$1',
    [input.idempotencyKey],
  );
  if (duplicate.rows[0]) return { ...duplicate.rows[0], duplicate: true };

  const proposed = await client.query<{ id: string; state: EffectState }>(
    `INSERT INTO effect_intents(job_id,run_id,approval_id,effect_kind,idempotency_key,provider_idempotency_key,state,payload,
       actor_type,actor_id,correlation_id,venture_id,experiment_id,ticket_id)
     VALUES($1,$2,$3,$4,$5,$6,'proposed',$7,$8,$9,$10,$11,$12,$13) RETURNING id,state`,
    [input.jobId ?? null, input.runId ?? null, input.approvalId ?? null, input.kind, input.idempotencyKey,
      externalKinds.has(input.kind) ? input.idempotencyKey : null, JSON.stringify(input.payload ?? {}),
      actor.actorType, actor.actorId, actor.correlationId, input.payload?.ventureId ?? null,
      input.payload?.experimentId ?? null, input.payload?.ticketId ?? null],
  );
  const deny = async (code: string) => {
    await client.query(
      `UPDATE effect_intents SET state='denied',policy_code=$2,finished_at=now(),updated_at=now() WHERE id=$1`,
      [proposed.rows[0].id, code],
    );
    await client.query(
      `INSERT INTO audit_events(actor_type,actor_id,event_type,entity_type,entity_id,correlation_id,payload)
       VALUES($1,$2,'effect_denied','effect_intent',$3,$4,$5)`,
      [actor.actorType, actor.actorId, proposed.rows[0].id, actor.correlationId, JSON.stringify({ policy_code: code, kind: input.kind })],
    );
    return { id: proposed.rows[0].id, state: 'denied' as EffectState, duplicate: false, policyCode: code };
  };
  const controls = await client.query<{ paused: boolean; killed: boolean; commercial_lock: boolean }>(
    'SELECT paused,killed,commercial_lock FROM system_controls WHERE singleton=true FOR UPDATE',
  );
  if (controls.rows[0]?.killed) return deny('system_killed');
  if (controls.rows[0]?.paused) return deny('system_paused');
  if (!hasScope(actor, input.kind === 'internal' ? 'effects:internal' : `effects:${input.kind}`)) return deny('credential_scope_mismatch');
  if (externalKinds.has(input.kind) && controls.rows[0]?.commercial_lock) return deny('commercial_lock');

  if (externalKinds.has(input.kind)) {
    const allowedActionTypes = approvalActionTypes[input.kind as Exclude<EffectKind, 'internal'>];
    const approval = input.approvalId
      ? await client.query<{ id: string }>(
          `SELECT id FROM approvals WHERE id=$1 AND status='approved' AND expires_at>now()
           AND action_type=ANY($2::text[]) FOR SHARE`,
          [input.approvalId, allowedActionTypes],
        )
      : { rows: [] };
    if (!approval.rows[0]) return deny(input.approvalId ? 'approval_scope_mismatch' : 'approval_required');
  }

  const inserted = await client.query<{ id: string; state: EffectState }>(
    `UPDATE effect_intents SET state='authorized',authorized_at=now(),updated_at=now() WHERE id=$1 RETURNING id,state`,
    [proposed.rows[0].id],
  );
  await client.query(
    `INSERT INTO audit_events(actor_type,actor_id,event_type,entity_type,entity_id,correlation_id,payload)
     VALUES($1,$2,'effect_authorized','effect_intent',$3,$4,$5)`,
    [actor.actorType, actor.actorId, inserted.rows[0].id, actor.correlationId,
      JSON.stringify({ kind: input.kind, idempotency_key: input.idempotencyKey, credential_scope: actor.credentialScope, origin_platform: actor.originPlatform })],
  );
  return { ...inserted.rows[0], duplicate: false };
}

export async function markExternalExecuting(client: PoolClient, effectId: string) {
  const result = await client.query(
    `UPDATE effect_intents SET state='executing',executing_at=now(),updated_at=now()
     WHERE id=$1 AND state='authorized' RETURNING id`,
    [effectId],
  );
  if (!result.rowCount) throw new EffectPolicyError('invalid_effect_state');
}

export async function claimAuthorizedEffect(client: PoolClient, effectId: string, kind: EffectKind) {
  const claimed = await client.query(
    `UPDATE effect_intents SET state='executing',executing_at=now(),updated_at=now()
     WHERE id=$1 AND effect_kind=$2 AND state='authorized' RETURNING id`,
    [effectId, kind],
  );
  return claimed.rowCount === 1;
}

export async function recordExternalResult(
  client: PoolClient,
  effectId: string,
  result: { outcome: 'succeeded' | 'failed' | 'ambiguous'; receipt?: Record<string, unknown>; error?: string },
) {
  const state: EffectState = result.outcome === 'ambiguous' ? 'reconciliation_required' : result.outcome;
  const updated = await client.query(
    `UPDATE effect_intents SET state=$2,receipt=$3,last_error=$4,finished_at=now(),updated_at=now()
     WHERE id=$1 AND state='executing' RETURNING id`,
    [effectId, state, result.receipt ? JSON.stringify(result.receipt) : null, result.error?.slice(0, 1000) ?? null],
  );
  if (!updated.rowCount) throw new EffectPolicyError('invalid_effect_state');
  return state;
}
