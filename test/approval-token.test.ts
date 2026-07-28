import test from 'node:test';
import assert from 'node:assert/strict';
import { issueApprovalToken, verifyApprovalToken } from '../src/approval-token.ts';

test('approval tokens are tamper-resistant and expire', () => {
  const secret = 'test-secret';
  const token = issueApprovalToken({ approvalId: 'a-1', action: 'approve', expiresAt: 2_000 }, secret);
  assert.deepEqual(verifyApprovalToken(token, secret, 1_999), { approvalId: 'a-1', action: 'approve', expiresAt: 2_000 });
  assert.equal(verifyApprovalToken(`${token}x`, secret, 1_999), null);
  assert.equal(verifyApprovalToken(token, secret, 2_000), null);
});
