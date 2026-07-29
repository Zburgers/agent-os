import { pool } from '../../src/db.ts';
import { executeExternalEffect, type IdempotentExternalProvider } from '../../src/external-effects.ts';

const effectId = process.env.CRASH_EFFECT_ID;
const providerUrl = process.env.CRASH_PROVIDER_URL;
if (!effectId || !providerUrl) throw new Error('crash_harness_configuration_missing');
const provider: IdempotentExternalProvider = {
  async accept(input) {
    const response = await fetch(`${providerUrl}/accept`, { method: 'POST', headers: { 'content-type': 'application/json', 'idempotency-key': input.idempotencyKey }, body: JSON.stringify(input) });
    if (!response.ok) throw new Error(`provider_accept_failed:${response.status}`);
    return await response.json() as any;
  },
  async lookup() { throw new Error('child_must_not_reconcile'); },
};
await executeExternalEffect(pool, effectId, provider, () => { process.kill(process.pid, 'SIGKILL'); });
