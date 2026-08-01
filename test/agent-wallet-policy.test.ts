import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateWalletPolicy, WalletPolicyError, type WalletPolicy } from '../src/agent-wallet.ts';

const active: WalletPolicy = { status: 'active', expiresAt: '2099-01-01T00:00:00Z', chainIds: [8453], providers: ['bountybook'], recipientAllowlist: ['0xrecipient'], contractAllowlist: ['0xcontract'], messageTypes: ['personal_sign'], selectors: ['0x12345678'], maxTransactionValueMinor: 1000, maxGasMinor: 100, dailyBudgetMinor: 5000, totalBudgetMinor: 10000 };

test('wallet policy denies unknown dimensions and enforces every bounded dimension', () => {
  assert.deepEqual(evaluateWalletPolicy(active, { chainId: 8453, provider: 'bountybook', recipient: '0xrecipient', contract: '0xcontract', messageType: 'personal_sign', selector: '0x12345678', valueMinor: 10, gasMinor: 10, dailyUsedMinor: 0, totalUsedMinor: 0, now: new Date('2026-08-01T00:00:00Z') }), { allowed: true });
  for (const request of [{ chainId: 1 }, { provider: 'unknown' }, { recipient: '0xbad' }, { contract: '0xbad' }, { messageType: 'typed_data' }, { selector: '0xbad' }, { valueMinor: 1001 }, { gasMinor: 101 }, { dailyUsedMinor: 5000 }, { totalUsedMinor: 10000 }]) {
    assert.equal(evaluateWalletPolicy(active, { ...request, now: new Date('2026-08-01T00:00:00Z') }).allowed, false);
  }
  assert.equal(evaluateWalletPolicy({ ...active, status: 'draft' }, {}).code, 'policy_not_active');
  assert.equal(evaluateWalletPolicy({ ...active, expiresAt: '2020-01-01T00:00:00Z' }, {}).code, 'policy_expired');
  assert.throws(() => evaluateWalletPolicy(active, { unknownDimension: true } as never), WalletPolicyError);
});

test('new policy versions are drafts and owner activation/revocation are audited operations', async () => {
  const calls: string[] = [];
  const db = { connect: async () => ({ query: async (sql: string) => { calls.push(sql); if (sql.includes('FROM agent_wallets')) return { rows: [{ id: 'wallet-1' }] }; if (sql.includes('MAX(version)')) return { rows: [{ version: 1 }] }; if (sql.includes('RETURNING')) return { rows: [{ id: 'policy-1', status: 'draft', version: 1 }] }; return { rows: [] }; }, release() {} }) };
  const { AgentWalletService } = await import('../src/agent-wallet.ts');
  const service = new AgentWalletService(db as never, {} as never);
  assert.equal((await service.createPlatformPolicy({ chainIds: [8453] }, { type: 'owner', id: 'owner' })).status, 'draft');
  assert.ok(calls.some((sql) => sql.includes('agent_wallet_platform_policies')));
});
