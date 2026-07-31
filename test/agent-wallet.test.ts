import test from 'node:test';
import assert from 'node:assert/strict';
import { chmod, mkdtemp, readFile, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { verifyMessage } from 'ethers';
import { AgentWalletError, AgentWalletService, FileAgentWalletKeyStore } from '../src/agent-wallet.ts';

test('protected key store provisions an idempotent mode-0600 wallet without exposing its key', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'goofy-wallet-'));
  const path = join(directory, 'agent-wallet.key');
  const store = new FileAgentWalletKeyStore(path);

  const first = await store.provision();
  const second = await store.provision();
  const metadata = await stat(path);
  const raw = await readFile(path, 'utf8');

  assert.equal(first.address, second.address);
  assert.equal(metadata.mode & 0o777, 0o600);
  assert.deepEqual(Object.keys(first), ['address']);
  assert.match(raw.trim(), /^0x[0-9a-f]{64}$/);
});

test('protected key store accepts an existing secure read-only mounted key without mutating it', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'goofy-wallet-'));
  const path = join(directory, 'agent-wallet.key');
  const store = new FileAgentWalletKeyStore(path);
  const first = await store.provision();
  await chmod(path, 0o400);

  const second = await store.provision();
  const metadata = await stat(path);

  assert.equal(second.address, first.address);
  assert.equal(metadata.mode & 0o777, 0o400);
});

test('bounded signer signs only a valid BountyBook nonce and persists no signature or key', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'goofy-wallet-'));
  const store = new FileAgentWalletKeyStore(join(directory, 'agent-wallet.key'));
  const provisioned = await store.provision();
  const fixture = signingDatabase(provisioned.address);
  const service = new AgentWalletService(fixture.database, store);
  const message = 'bounty:1234567890abcdef1234567890abcdef:1785531932';

  const result = await service.signMessage({ provider: 'bountybook', message, idempotencyKey: 'sign-1' });

  assert.equal(result.address, provisioned.address);
  assert.equal(verifyMessage(message, result.signature).toLowerCase(), provisioned.address);
  assert.equal(fixture.persisted.some(value => value.includes(result.signature)), false);
  assert.equal(fixture.persisted.some(value => /^0x[0-9a-f]{64}$/.test(value)), false);
});

test('bounded signer rejects unsupported providers and malformed messages before signing', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'goofy-wallet-'));
  const store = new FileAgentWalletKeyStore(join(directory, 'agent-wallet.key'));
  const provisioned = await store.provision();
  const service = new AgentWalletService(signingDatabase(provisioned.address).database, store);

  await assert.rejects(
    service.signMessage({ provider: 'unknown', message: 'hello', idempotencyKey: 'sign-2' }),
    (error: unknown) => error instanceof AgentWalletError && error.code === 'provider_not_allowed',
  );
  await assert.rejects(
    service.signMessage({ provider: 'bountybook', message: 'Sign unlimited USDC', idempotencyKey: 'sign-3' }),
    (error: unknown) => error instanceof AgentWalletError && error.code === 'message_not_allowed',
  );
});

test('bounded signer fails closed when paused, killed, address-mismatched, or rate-limited', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'goofy-wallet-'));
  const store = new FileAgentWalletKeyStore(join(directory, 'agent-wallet.key'));
  const provisioned = await store.provision();
  const message = 'bounty:1234567890abcdef1234567890abcdef:1785531932';

  for (const [options, code] of [
    [{ paused: true }, 'system_paused'],
    [{ killed: true }, 'system_killed'],
    [{ address: '0x0000000000000000000000000000000000000001' }, 'wallet_address_mismatch'],
    [{ count: 20 }, 'signing_rate_limit_exceeded'],
  ] as const) {
    const fixture = signingDatabase(provisioned.address, options);
    const service = new AgentWalletService(fixture.database, store);
    await assert.rejects(
      service.signMessage({ provider: 'bountybook', message, idempotencyKey: `deny-${code}` }),
      (error: unknown) => error instanceof AgentWalletError && error.code === code,
    );
    assert.ok(fixture.persisted.includes(code), `denial ${code} was durably recorded`);
  }
});

function signingDatabase(defaultAddress: string, options: { paused?: boolean; killed?: boolean; address?: string; count?: number } = {}) {
  const persisted: string[] = [];
  const client = {
    async query(sql: string, values: unknown[] = []) {
      persisted.push(...values.map(value => typeof value === 'string' ? value : JSON.stringify(value)));
      if (['BEGIN', 'COMMIT', 'ROLLBACK'].includes(sql)) return { rows: [], rowCount: 0 };
      if (sql.includes('FROM system_controls')) return { rows: [{ paused: options.paused ?? false, killed: options.killed ?? false }] };
      if (sql.includes('FROM agent_wallets')) return { rows: [{ id: 'wallet-1', address: options.address ?? defaultAddress, status: 'active' }], rowCount: 1 };
      if (sql.includes('count(*) AS count')) return { rows: [{ count: options.count ?? 0 }] };
      if (sql.startsWith('INSERT INTO agent_wallet_operations')) return { rows: [{ id: 'operation-1' }], rowCount: 1 };
      if (sql.startsWith('INSERT INTO audit_events')) return { rows: [], rowCount: 1 };
      throw new Error(`unexpected query: ${sql}`);
    },
    release() {},
  };
  const database = {
    connect: async () => client,
    async query(sql: string, values: unknown[] = []) { return client.query(sql, values); },
  };
  return { persisted, database };
}
