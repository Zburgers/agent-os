import test from 'node:test';
import assert from 'node:assert/strict';
import { fetchNearBidStatus, loadNearAgentCredential, shouldAlertForBidStatus } from '../src/near-bid-monitor.ts';

const bidId = '09d31f07-ca9f-4039-8e78-992b6efe5c29';

test('finds the configured bid without exposing the API key', async () => {
  let authorization = '';
  const bid = await fetchNearBidStatus({
    bidId,
    apiKey: 'protected-key',
    fetchImpl: async (_url, init) => {
      authorization = String((init?.headers as Record<string, string>).authorization);
      return new Response(JSON.stringify({ items: [
        { bid_id: bidId, job_id: 'job-1', status: 'awarded', amount: '4.0', budget_token: 'NEAR' },
      ] }), { status: 200 });
    },
  });

  assert.equal(authorization, 'Bearer protected-key');
  assert.deepEqual(bid, { id: bidId, jobId: 'job-1', status: 'awarded', amount: '4.0', budgetToken: 'NEAR' });
  assert.equal(JSON.stringify(bid).includes('protected-key'), false);
});

test('rejects missing bids and malformed provider responses', async () => {
  await assert.rejects(fetchNearBidStatus({
    bidId,
    apiKey: 'protected-key',
    fetchImpl: async () => new Response('{"items":[]}', { status: 200 }),
  }), /near_bid_not_found/);
  await assert.rejects(fetchNearBidStatus({
    bidId,
    apiKey: 'protected-key',
    fetchImpl: async () => new Response('unavailable', { status: 503 }),
  }), /near_market_http_503/);
});

test('alerts only for a meaningful state reached after pending', () => {
  assert.equal(shouldAlertForBidStatus(undefined, 'pending'), false);
  assert.equal(shouldAlertForBidStatus('pending', 'pending'), false);
  assert.equal(shouldAlertForBidStatus('pending', 'awarded'), true);
  assert.equal(shouldAlertForBidStatus('awarded', 'awarded'), false);
  assert.equal(shouldAlertForBidStatus(undefined, 'awarded'), true);
});

test('loads only the API key from a protected NEAR credential', async () => {
  const credential = await loadNearAgentCredential('/run/secrets/near_agent', {
    statImpl: async () => ({ isFile: () => true, mode: 0o100400 }),
    readFileImpl: async () => JSON.stringify({ api_key: 'protected-key', agent_id: 'not-returned' }),
  });
  assert.deepEqual(credential, { apiKey: 'protected-key' });
});

test('refuses permissive or malformed NEAR credential files', async () => {
  await assert.rejects(loadNearAgentCredential('/run/secrets/near_agent', {
    statImpl: async () => ({ isFile: () => true, mode: 0o100644 }),
    readFileImpl: async () => JSON.stringify({ api_key: 'protected-key' }),
  }), /near_credential_permissions/);
  await assert.rejects(loadNearAgentCredential('relative.json'), /near_credential_path/);
});
