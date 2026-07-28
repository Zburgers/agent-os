import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateExpense } from '../src/finance.ts';

test('initial capital policy blocks spending before tranche release even when approved', () => {
  assert.deepEqual(evaluateExpense({
    amountPaise: 100,
    todaySpentPaise: 0,
    experimentSpentPaise: 0,
    spendablePaise: 0,
    reservePaise: 200000,
    approved: true,
  }), { allowed: false, reason: 'no_released_capital' });
});

test('expense controls enforce per-expense daily and experiment limits before a charge', () => {
  assert.deepEqual(evaluateExpense({
    amountPaise: 301,
    todaySpentPaise: 0,
    experimentSpentPaise: 0,
    spendablePaise: 50000,
    reservePaise: 200000,
    approved: true,
    singleLimitPaise: 300,
    dailyLimitPaise: 800,
    experimentLimitPaise: 1000,
  }), { allowed: false, reason: 'single_expense_limit_exceeded' });
});

import { FinancialPolicyError, LedgerService } from '../src/finance.ts';

type Call = { sql: string; values?: unknown[] };
function ledgerFixture({ released = 0, reserve = 200000, cash = 300000, expenses = 0, duplicate = false } = {}) {
  const calls: Call[] = [];
  const client = {
    async query(sql: string, values?: unknown[]) {
      calls.push({ sql, values });
      if (sql === 'BEGIN' || sql === 'COMMIT' || sql === 'ROLLBACK' || sql.startsWith('INSERT INTO audit_events')) return { rows: [] };
      if (sql.startsWith('SELECT id FROM ledger_entries')) return { rows: duplicate ? [{ id: 'existing' }] : [] };
      if (sql.startsWith('SELECT paused')) return { rows: [{ paused: false, killed: false }] };
      if (sql.startsWith('SELECT id FROM approvals')) return { rows: [{ id: 'approval' }] };
      if (sql.startsWith('SELECT released_operating')) return { rows: [{ released, reserve }] };
      if (sql.startsWith('SELECT COALESCE(SUM(gross_minor)')) return { rows: [{ today: 0, experiment: 0, expenses, cash }] };
      if (sql.startsWith('INSERT INTO ledger_entries')) return { rows: [{ id: 'new-entry' }] };
      throw new Error(`unexpected query: ${sql}`);
    },
    release() {},
  };
  return { calls, db: { connect: async () => client } };
}
const expense = { transactionId: 'txn-1', entryType: 'expense' as const, currency: 'INR', grossMinor: 100, netMinor: 100, counterparty: 'vendor', ventureId: 'venture-1', experimentId: 'experiment-1', paymentStatus: 'settled' as const, evidenceUri: 'artifact://receipt', idempotencyKey: 'expense-1' };
const justification = { category: 'infrastructure', objective: 'verify control', expectedResult: 'tested gate', evidenceUri: 'artifact://evidence', alternatives: ['self-hosted alternative'], worstCaseLoss: 'INR 1', successCondition: 'test passes', stopCondition: 'policy rejection', expectedPayback: 'none', confidence: 90 };

test('reserve preservation rejects an otherwise approved released expense before any ledger insert', async () => {
  const fixture = ledgerFixture({ released: 500, reserve: 200000, cash: 200050 });
  const service = new LedgerService(fixture.db, { singleLimitMinor: 300, dailyLimitMinor: 800, experimentLimitMinor: 1000 });
  await assert.rejects(service.append(expense, { approvalId: 'approval', justification }), (error: unknown) => error instanceof FinancialPolicyError && error.reason === 'reserve_preservation_required');
  assert.equal(fixture.calls.some((call) => call.sql.startsWith('INSERT INTO ledger_entries')), false);
  assert.equal(fixture.calls.some((call) => call.sql === 'ROLLBACK'), true);
});

test('ledger service atomically appends an audited approved expense and treats retry as idempotent', async () => {
  const fixture = ledgerFixture({ released: 500, reserve: 200000, cash: 300000 });
  const service = new LedgerService(fixture.db, { singleLimitMinor: 300, dailyLimitMinor: 800, experimentLimitMinor: 1000 });
  assert.deepEqual(await service.append(expense, { approvalId: 'approval', justification }), { id: 'new-entry', duplicate: false });
  assert.equal(fixture.calls.some((call) => call.sql.startsWith('INSERT INTO audit_events')), true);
  const retry = ledgerFixture({ duplicate: true });
  const retryService = new LedgerService(retry.db, { singleLimitMinor: 300, dailyLimitMinor: 800, experimentLimitMinor: 1000 });
  assert.deepEqual(await retryService.append(expense, { approvalId: 'approval', justification }), { id: 'existing', duplicate: true });
  assert.equal(retry.calls.some((call) => call.sql.startsWith('INSERT INTO ledger_entries')), false);
});
