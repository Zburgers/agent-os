import test from 'node:test';
import assert from 'node:assert/strict';
import { AgentWalletTransactionService, AgentWalletTransactionError } from '../src/agent-wallet-transactions.ts';

test('dedicated transaction service simulates and remains fail-closed without live authorization', async () => {
  const persisted: string[] = [];
  const database = { query: async (sql: string, values: unknown[] = []) => { persisted.push(sql, ...values.map(String)); return { rows: [{ id: 'tx-1', status: 'simulated', nonce: '7' }] }; } };
  let signed = false; let broadcast = false;
  const service = new AgentWalletTransactionService(database as never, { sign: async () => { signed = true; return 'raw-signature'; } }, { broadcast: async () => { broadcast = true; return '0xhash'; } });
  const draft = await service.createDraft({ idempotencyKey: 'tx-1', chainId: 8453, recipient: '0xrecipient', valueMinor: 0, gasMinor: 1 }, { policy: { status: 'active', chainIds: [8453], providers: ['bountybook'], recipientAllowlist: ['0xrecipient'], contractAllowlist: [], messageTypes: [], selectors: [], maxTransactionValueMinor: 0, maxGasMinor: 10, dailyBudgetMinor: 10, totalBudgetMinor: 10 }, controls: { paused: false, killed: false }, dailyUsedMinor: 0, totalUsedMinor: 0 });
  assert.equal(draft.status, 'simulated');
  await assert.rejects(service.execute(draft.id), (error: unknown) => error instanceof AgentWalletTransactionError && error.code === 'live_broadcast_not_authorized');
  assert.equal(signed, false); assert.equal(broadcast, false); assert.equal(persisted.some((item) => item.includes('raw-signature')), false);
});

test('transaction service maps ambiguous provider outcomes to reconciliation and preserves idempotency', async () => {
  const statuses: string[] = [];
  const database = { query: async (sql: string) => { if (sql.includes('INSERT')) statuses.push('insert'); if (sql.includes('UPDATE')) statuses.push('update'); return { rows: [{ id: 'tx-2', status: 'reconciliation_required' }] }; } };
  const service = new AgentWalletTransactionService(database as never, { sign: async () => 'signature' }, { broadcast: async () => { throw new Error('timeout'); } });
  const result = await service.reconcile('tx-2', { providerReference: '0xhash', outcome: 'unknown' });
  assert.equal(result.status, 'reconciliation_required'); assert.ok(statuses.length > 0);
});
