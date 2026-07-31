import test from 'node:test';
import assert from 'node:assert/strict';
import { publicJavaScriptAsset } from '../src/static-assets.ts';

test('allows only exact wallet JavaScript assets before owner authentication', () => {
  assert.equal(publicJavaScriptAsset('/assets/wallet-client.js'), 'wallet-client.js');
  assert.equal(publicJavaScriptAsset('/assets/metamask-connect.js'), 'metamask-connect.js');
});

test('rejects non-wallet assets and traversal attempts from the pre-auth allowlist', () => {
  assert.equal(publicJavaScriptAsset('/assets/control-plane.js'), null);
  assert.equal(publicJavaScriptAsset('/assets/wallet-client.js.map'), null);
  assert.equal(publicJavaScriptAsset('/assets/../.env'), null);
  assert.equal(publicJavaScriptAsset('/api/wallet/status'), null);
});
