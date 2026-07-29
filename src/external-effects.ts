import type { Pool, PoolClient } from 'pg';
import { EffectPolicyError, markExternalExecuting, recordExternalResult, type EffectKind } from './effects.ts';

export type ProviderReceipt = { providerReference: string; acceptedAt: string; detail?: Record<string, unknown> };
export interface IdempotentExternalProvider {
  accept(input: { idempotencyKey: string; kind: EffectKind; payload: Record<string, unknown> }): Promise<ProviderReceipt>;
  lookup(idempotencyKey: string): Promise<ProviderReceipt | null>;
}

type EffectRow = { id: string; effect_kind: EffectKind; idempotency_key: string; payload: Record<string, unknown>; state: 'executing' | 'reconciliation_required' };
const external = new Set<EffectKind>(['message', 'expense', 'deployment', 'payment', 'account_change', 'purchase']);

/**
 * Commits `executing` before calling a provider. If this process dies after the
 * provider accepts, recovery can query the provider by the same idempotency key
 * without ever issuing a second external request.
 */
export async function executeExternalEffect(database: Pool, effectId: string, provider: IdempotentExternalProvider, afterAccepted?: () => never | void) {
  const client = await database.connect();
  let row: EffectRow;
  try {
    await client.query('BEGIN');
    const selected = await client.query<EffectRow>("SELECT id,effect_kind,idempotency_key,payload,state FROM effect_intents WHERE id=$1 AND state='authorized' FOR UPDATE", [effectId]);
    row = selected.rows[0];
    if (!row || !external.has(row.effect_kind)) throw new EffectPolicyError('invalid_external_effect');
    await markExternalExecuting(client, effectId);
    await client.query('COMMIT');
  } catch (error) { await client.query('ROLLBACK').catch(() => undefined); throw error; } finally { client.release(); }

  try {
    const receipt = await provider.accept({ idempotencyKey: row!.idempotency_key, kind: row!.effect_kind, payload: row!.payload ?? {} });
    afterAccepted?.();
    const resultClient = await database.connect();
    try {
      await resultClient.query('BEGIN');
      await recordExternalResult(resultClient, effectId, { outcome: 'succeeded', receipt: { provider_reference: receipt.providerReference, accepted_at: receipt.acceptedAt, detail: receipt.detail ?? {} } });
      await resultClient.query("INSERT INTO audit_events(actor_type,actor_id,event_type,entity_type,entity_id,payload) VALUES('worker','external-effect-executor','external_effect_succeeded','effect_intent',$1,$2)", [effectId, JSON.stringify({ provider_reference: receipt.providerReference })]);
      await resultClient.query('COMMIT');
    } catch (error) { await resultClient.query('ROLLBACK').catch(() => undefined); throw error; } finally { resultClient.release(); }
    return receipt;
  } catch (error) {
    const failureClient = await database.connect();
    try {
      await failureClient.query('BEGIN');
      await recordExternalResult(failureClient, effectId, { outcome: 'ambiguous', error: error instanceof Error ? error.message : 'provider_call_failed' });
      await failureClient.query('COMMIT');
    } catch { await failureClient.query('ROLLBACK').catch(() => undefined); } finally { failureClient.release(); }
    throw error;
  }
}

/** Reconciles crash/timeout boundaries using provider lookup only; it never replays accept(). */
export async function reconcileExternalEffects(database: Pool, provider: IdempotentExternalProvider, limit = 20) {
  const client = await database.connect();
  try {
    await client.query('BEGIN');
    const pending = await client.query<EffectRow>(
      "SELECT id,effect_kind,idempotency_key,payload,state FROM effect_intents WHERE state IN ('executing','reconciliation_required') ORDER BY executing_at NULLS LAST,updated_at LIMIT $1 FOR UPDATE SKIP LOCKED",
      [limit],
    );
    let reconciled = 0;
    for (const effect of pending.rows) {
      if (!external.has(effect.effect_kind)) continue;
      const receipt = await provider.lookup(effect.idempotency_key);
      if (!receipt) {
        await client.query("UPDATE effect_intents SET state='reconciliation_required',last_error='provider_receipt_not_found',updated_at=now() WHERE id=$1 AND state='executing'", [effect.id]);
        continue;
      }
      const updated = await client.query(
        "UPDATE effect_intents SET state='succeeded',receipt=$2,finished_at=now(),updated_at=now(),last_error=NULL WHERE id=$1 AND state IN ('executing','reconciliation_required') RETURNING id",
        [effect.id, JSON.stringify({ provider_reference: receipt.providerReference, accepted_at: receipt.acceptedAt, detail: receipt.detail ?? {} })],
      );
      if (updated.rowCount) {
        reconciled += 1;
        await client.query("INSERT INTO audit_events(actor_type,actor_id,event_type,entity_type,entity_id,payload) VALUES('system','external-effect-reconciler','external_effect_reconciled','effect_intent',$1,$2)", [effect.id, JSON.stringify({ provider_reference: receipt.providerReference, idempotency_key: effect.idempotency_key })]);
      }
    }
    await client.query('COMMIT');
    return reconciled;
  } catch (error) { await client.query('ROLLBACK').catch(() => undefined); throw error; } finally { client.release(); }
}
