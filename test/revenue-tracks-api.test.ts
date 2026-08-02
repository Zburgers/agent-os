import test from 'node:test';
import assert from 'node:assert/strict';
import { revenueTrackMutationAllowed } from '../src/auth.ts';

test('Revenue Paths reads may use authenticated owner sessions but mutations require agent scope and idempotency', () => {
  assert.equal(revenueTrackMutationAllowed('agent', 'track-create-1'), true);
  assert.equal(revenueTrackMutationAllowed('agent', ''), false);
  assert.equal(revenueTrackMutationAllowed('owner', 'track-create-1'), false);
  assert.equal(revenueTrackMutationAllowed(null, 'track-create-1'), false);
});

test('Revenue Paths mutation authorization rejects missing or whitespace idempotency keys', () => {
  for (const key of [undefined, '', '   ']) assert.equal(revenueTrackMutationAllowed('agent', key), false);
});
