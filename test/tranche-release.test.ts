import test from 'node:test';
import assert from 'node:assert/strict';
import { FinancialPolicyError, releaseOperatingTranche } from '../src/finance.ts';

test('tranche release rejects an untrusted runtime actor before connecting to PostgreSQL', async () => {
  let connected = false;
  const database = { async connect() { connected = true; throw new Error('must not connect'); } };
  await assert.rejects(
    releaseOperatingTranche(database, 'approval-1', { type: 'agent', id: 'agent-1' } as any),
    (error: unknown) => error instanceof FinancialPolicyError && error.reason === 'owner_authority_required',
  );
  assert.equal(connected, false);
});
