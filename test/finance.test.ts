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
