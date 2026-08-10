import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildAccountSummary,
  discoverRuntimeAccounts,
  validateAccountRegistration,
} from '../src/account-inventory.ts';

test('discovers configured account integrations from presence metadata without returning secret values', () => {
  const secret = 'agentmail-api-secret-must-not-escape';
  const discovered = discoverRuntimeAccounts({
    AGENTMAIL_API_KEY: secret,
    AGENTMAIL_EMAIL: 'goofy@example.invalid',
    PAYPAL_CLIENT_ID: 'client-id',
    PAYPAL_SECRET: 'paypal-secret-must-not-escape',
    PAYPAL_ENVIRONMENT: 'sandbox',
  });

  const serialized = JSON.stringify(discovered);
  assert.match(serialized, /AgentMail/);
  assert.match(serialized, /goofy@example\.invalid/);
  assert.match(serialized, /PayPal/);
  assert.doesNotMatch(serialized, /agentmail-api-secret-must-not-escape/);
  assert.doesNotMatch(serialized, /paypal-secret-must-not-escape/);
  assert.equal(discovered.find((account) => account.platformKey === 'agentmail')?.accessStatus, 'available');
  assert.equal(discovered.find((account) => account.platformKey === 'paypal')?.accessStatus, 'available');
});

test('reports a protected credential file as missing or available using metadata only', () => {
  const probes: string[] = [];
  const missing = discoverRuntimeAccounts(
    { PAYANAGENT_PROVIDER_CREDENTIAL_FILE: '/run/secrets/payanagent' },
    (path) => { probes.push(path); return false; },
  );
  assert.deepEqual(probes, ['/run/secrets/payanagent']);
  assert.equal(missing.find((account) => account.platformKey === 'payanagent')?.accessStatus, 'missing');
  assert.equal(missing.find((account) => account.platformKey === 'payanagent')?.credentials[0].source, 'protected runtime file');

  const available = discoverRuntimeAccounts(
    { PAYANAGENT_PROVIDER_CREDENTIAL_FILE: '/run/secrets/payanagent' },
    () => true,
  );
  assert.equal(available.find((account) => account.platformKey === 'payanagent')?.accessStatus, 'available');
});

test('reports partial integrations and never invents accounts without a credential signal', () => {
  const discovered = discoverRuntimeAccounts({ N8N_COMMUNITY_USERNAME: 'goofy' });
  const n8n = discovered.find((account) => account.platformKey === 'n8n-community');
  assert.equal(n8n?.accessStatus, 'partial');
  assert.equal(n8n?.accountIdentifier, 'goofy');
  assert.equal(discovered.some((account) => account.platformKey === 'opentask'), false);
});

test('rejects secret-bearing registration metadata before persistence', () => {
  assert.throws(
    () => validateAccountRegistration({
      platformKey: 'payanagent',
      displayName: 'PayanAgent',
      category: 'marketplace',
      credentials: [{ type: 'api_key', label: 'Provider key', source: 'runtime environment', value: 'secret' }],
    }),
    /credential_value_not_allowed/,
  );

  const registration = validateAccountRegistration({
    platformKey: 'opentask',
    displayName: 'OpenTask',
    category: 'marketplace',
    homepageUrl: 'https://opentask.ai',
    accountIdentifier: 'goofy-agent',
    credentials: [{ type: 'api_key', label: 'API key', source: 'protected runtime file', status: 'available', scopes: ['read'] }],
  });
  assert.deepEqual(registration.credentials[0], {
    type: 'api_key',
    label: 'API key',
    source: 'protected runtime file',
    status: 'available',
    scopes: ['read'],
  });
});

test('summarizes availability and attention counts from safe account metadata', () => {
  const summary = buildAccountSummary([
    { platformKey: 'one', displayName: 'One', category: 'other', accessStatus: 'available', credentials: [] },
    { platformKey: 'two', displayName: 'Two', category: 'other', accessStatus: 'partial', credentials: [] },
    { platformKey: 'three', displayName: 'Three', category: 'other', accessStatus: 'missing', credentials: [] },
  ]);
  assert.deepEqual(summary, { total: 3, available: 1, partial: 1, attention: 2, credentials: 0 });
});
