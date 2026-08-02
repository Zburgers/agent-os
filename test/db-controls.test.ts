import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { AgentWalletTransactionService } from '../src/agent-wallet-transactions.ts';
import { createManualCodexOccurrence } from '../src/codex-operating-block-control.ts';
import { runCodexOperatingBlock } from '../src/codex-operating-block.ts';
import { controls } from '../src/db.ts';
import { evaluateAction } from '../src/policy.ts';

type ControlRow = { paused: boolean; killed: boolean; commercial_lock: boolean };

function controlDatabase(row?: ControlRow) {
  const calls: string[] = [];
  return {
    calls,
    database: {
      schedulePaused: true,
      async query(sql: string) {
        calls.push(sql);
        return { rows: row ? [row] : [] };
      },
    },
  };
}

test('Codex schedule pause does not alter shared global controls', async () => {
  const fake = controlDatabase({ paused: false, killed: false, commercial_lock: false });
  const state = await controls(fake.database as never);

  assert.deepEqual(state, { paused: false, killed: false, commercial_lock: false });
  assert.equal(fake.calls.length, 1);
  assert.match(fake.calls[0], /FROM system_controls/);
  assert.doesNotMatch(fake.calls[0], /codex_operating_block_config|schedule_paused/);
  assert.deepEqual(evaluateAction(state, { kind: 'deployment' }), { allowed: true });
});

test('shared controls stay fail-closed when the global singleton is missing', async () => {
  const fake = controlDatabase();
  assert.deepEqual(await controls(fake.database as never), {
    paused: false,
    killed: true,
    commercial_lock: true,
  });
});

test('global pause and kill still stop governed Codex execution', async () => {
  let spawned = false;
  for (const row of [
    { paused: true, killed: false, commercial_lock: false },
    { paused: false, killed: true, commercial_lock: false },
  ]) {
    const fake = controlDatabase(row);
    const result = await runCodexOperatingBlock({
      executable: '/usr/bin/codex',
      outputFile: '/tmp/codex-control-test-output',
      spawn: (() => {
        spawned = true;
        throw new Error('unexpected_spawn');
      }) as never,
      control: () => controls(fake.database as never),
    });
    assert.equal(result.status, 'skipped');
  }
  assert.equal(spawned, false);
});

test('wallet simulation is not rejected when only the Codex schedule is paused', async () => {
  const fake = controlDatabase({ paused: false, killed: false, commercial_lock: false });
  const state = await controls(fake.database as never);
  const database = {
    connect: async () => ({
      async query(sql: string) {
        if (sql.includes('SELECT id,status,envelope')) return { rows: [] };
        if (sql.includes('SELECT COALESCE')) return { rows: [{ daily_used: 0, total_used: 0 }] };
        return {
          rows: [{
            id: 'tx-schedule-paused',
            status: 'simulated',
            envelope: { chainId: 8453, recipient: '0xrecipient', valueMinor: 0, gasMinor: 1 },
          }],
        };
      },
      release() {},
    }),
  };
  const service = new AgentWalletTransactionService(
    database as never,
    { sign: async () => 'unused' },
    { broadcast: async () => 'unused' },
  );

  const draft = await service.createDraft(
    { idempotencyKey: 'schedule-paused-wallet', chainId: 8453, recipient: '0xrecipient', valueMinor: 0, gasMinor: 1 },
    {
      policy: {
        chainIds: [8453],
        providers: ['bountybook'],
        recipientAllowlist: ['0xrecipient'],
        contractAllowlist: [],
        messageTypes: [],
        selectors: [],
        maxTransactionValueMinor: 0,
        maxGasMinor: 10,
        dailyBudgetMinor: 10,
        totalBudgetMinor: 10,
      },
      policyId: 'policy-1',
      walletId: 'wallet-1',
      lifecycleStatus: 'active',
      controls: state,
    },
  );

  assert.equal(draft.status, 'simulated');
});

test('manual Codex admission remains independent of schedule pause', async () => {
  const calls: string[] = [];
  const database = {
    schedulePaused: true,
    async connect() {
      return {
        async query(sql: string, values: unknown[] = []) {
          calls.push(sql);
          if (sql === 'BEGIN' || sql === 'COMMIT' || sql === 'ROLLBACK') return { rows: [] };
          if (sql.includes('pg_try_advisory_xact_lock')) return { rows: [{ acquired: true }] };
          if (sql.includes('codex_occurrence_recovered')) return { rows: [] };
          if (sql.includes('FROM codex_operating_block_occurrences occurrence')) return { rows: [] };
          if (sql.includes('INSERT INTO codex_operating_block_occurrences')) {
            return { rows: [{ id: 'manual-schedule-paused', occurrence_key: String(values[0]) }] };
          }
          throw new Error(`Unexpected SQL: ${sql}`);
        },
        release() {},
      };
    },
  };

  const result = await createManualCodexOccurrence(database as never);
  assert.equal(result.status, 'queued');
  assert.equal(calls.some((sql) => /codex_operating_block_config|schedule_paused/.test(sql)), false);
});

test('runner keeps schedule pause scoped to scheduled occurrences', async () => {
  const runner = await readFile(new URL('../scripts/run-codex-operating-block.mjs', import.meta.url), 'utf8');
  assert.match(
    runner,
    /occurrenceMeta\.rows\[0\]\?\.trigger_kind === 'scheduled' && paused\.rows\[0\]\?\.schedule_paused/,
  );
});
