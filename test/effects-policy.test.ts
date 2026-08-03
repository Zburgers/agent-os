import test from 'node:test';
import assert from 'node:assert/strict';
import { approvalActionTypesForEffect } from '../src/effects.ts';

test('marketplace worker bid approvals authorize account-change effects', () => {
  assert.equal(approvalActionTypesForEffect('account_change').includes('marketplace_worker_bids'), true);
});
