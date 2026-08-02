import test from 'node:test';
import assert from 'node:assert/strict';
import { renderWalletPage } from '../src/wallet-page.ts';

test('wallet page exposes dedicated agent wallet policy and redacted signing activity', () => {
  const html = renderWalletPage('csrf', undefined, { link: null, balance_wei: null, intents: [] }, {
    configured: true,
    key_exposure: 'protected_runtime_only',
    wallet: {
      address: '0x1111111111111111111111111111111111111111', status: 'active',
      allowed_chain_ids: [8453], policy: { allowed_providers: ['bountybook'], transaction_signing: false },
    },
    operations: [{
      id: 'operation-1', provider: 'bountybook', operation_type: 'personal_sign',
      message_hash: 'a'.repeat(64), message_preview: 'bounty:abc', outcome: 'succeeded',
      error_code: null, created_at: '2026-08-01T00:00:00Z',
    }],
  });

  for (const value of ['Dedicated Goofy wallet', '0x1111111111111111111111111111111111111111', 'bountybook', 'personal_sign', 'protected_runtime_only']) assert.ok(html.includes(value), value);
  assert.doesNotMatch(html, /0x[0-9a-f]{128,}/i);
});

test('wallet page exposes draft policy controls, immutable versions, revocation, and governed withdrawals', () => {
  const html = renderWalletPage('csrf', undefined, { link: null, balance_wei: null, intents: [] }, { wallet: { address: '0x1111111111111111111111111111111111111111', status: 'active', allowed_chain_ids: [8453], policy: {} }, policyVersions: [{ version: 1, status: 'draft' }] });
  for (const value of ['Create policy draft', 'Activate', 'Revoke', 'immutable version', 'Owner-linked MetaMask', 'receiving funds', 'governed withdrawal']) assert.match(html, new RegExp(value, 'i'));
  assert.doesNotMatch(html, /COMPLETE autonomy/i);
});
