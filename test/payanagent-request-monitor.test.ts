import test from 'node:test';
import assert from 'node:assert/strict';
import { fetchPayanAgentRequestStatus, loadPayanAgentCredential, shouldAlertForPayanAgentStatus } from '../src/payanagent-request-monitor.ts';

const response = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

test('normalizes request and only the provider bids without leaking bid messages', async () => {
  const result = await fetchPayanAgentRequestStatus({
    requestId: 'ks76vc9pzpz3qfgf8aawjckn5n8bezhf',
    apiKey: 'key',
    providerId: 'provider-1',
    fetchImpl: async () => response({ request: { _id: 'ks76vc9pzpz3qfgf8aawjckn5n8bezhf', title: 'catalog', status: 'open', budgetMaxCents: 4, escrowDepositedCents: 4 }, bids: [
      { _id: 'bid-001', bidderId: 'provider-1', status: 'pending', message: 'private message' },
      { _id: 'bid-002', bidderId: 'other', status: 'accepted', message: 'other message' },
    ] }),
  });
  assert.deepEqual(result, {
    requestId: 'ks76vc9pzpz3qfgf8aawjckn5n8bezhf', title: 'catalog', requestStatus: 'open', budgetMaxCents: 4,
    escrowDepositedCents: 4, ownBids: [{ id: 'bid-001', status: 'pending' }],
  });
  assert.equal(JSON.stringify(result).includes('message'), false);
});

test('rejects malformed request status and non-success responses', async () => {
  await assert.rejects(() => fetchPayanAgentRequestStatus({
    requestId: 'ks76vc9pzpz3qfgf8aawjckn5n8bezhf', apiKey: 'key', providerId: 'provider-1',
    fetchImpl: async () => response({ request: { _id: 'ks76vc9pzpz3qfgf8aawjckn5n8bezhf', status: '???' }, bids: [] }),
  }), /payanagent_request_status_invalid/);
  await assert.rejects(() => fetchPayanAgentRequestStatus({
    requestId: 'ks76vc9pzpz3qfgf8aawjckn5n8bezhf', apiKey: 'key', providerId: 'provider-1',
    fetchImpl: async () => response({}, 401),
  }), /payanagent_http_401/);
});

test('alerts only after the first observation when a state changes', () => {
  const current = { requestId: 'request-1', title: 'catalog', requestStatus: 'accepted', budgetMaxCents: 4, escrowDepositedCents: 4, ownBids: [{ id: 'bid-1', status: 'accepted' }] };
  assert.equal(shouldAlertForPayanAgentStatus(undefined, current), false);
  assert.equal(shouldAlertForPayanAgentStatus(current, current), false);
  assert.equal(shouldAlertForPayanAgentStatus({ ...current, requestStatus: 'open' }, current), true);
});

test('loads only an absolute mode-0600 credential file', async () => {
  await assert.rejects(() => loadPayanAgentCredential('relative.json', { statImpl: async () => ({ isFile: () => true, mode: 0o600 }) }), /payanagent_credential_path/);
  const value = await loadPayanAgentCredential('/tmp/provider.json', {
    statImpl: async () => ({ isFile: () => true, mode: 0o600 }),
    readFileImpl: async () => JSON.stringify({ api_key: 'secret', agent_id: 'j577ep57b444jyazchzm5hbe5d8brsp6' }),
  });
  assert.deepEqual(value, { apiKey: 'secret', providerId: 'j577ep57b444jyazchzm5hbe5d8brsp6' });
});
