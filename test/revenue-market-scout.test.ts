import test from 'node:test';
import assert from 'node:assert/strict';
import { runRevenueMarketScout } from '../src/revenue-market-scout.ts';

test('scheduled revenue scout reads all configured public sources without side effects', async () => {
  const responses = new Map<string, unknown>([
    ['spore', { tasks: [{ id: 'spore-1', title: 'FastAPI tests', budget_usd: 80, posted_at: '2026-08-03T00:00:00Z', requirements: ['testing'], assigned_agent_id: null }] }],
    ['offers', { offers: [] }],
    ['requests', { requests: [] }],
    ['bounty', { jobs: [] }],
    ['the402', { services: [{ id: 'svc-1', name: 'API reliability audit', price: { fixed: '$3.00' }, category: 'testing', tags: ['api'], service_type: 'automated_service' }] }],
    ['taskbounty', { data: [] }],
  ]);
  const result = await runRevenueMarketScout(async (url) => {
    const key = url.includes('sporeagent') ? 'spore' : url.includes('offers') ? 'offers' : url.includes('requests') ? 'requests' : url.includes('bountybook') ? 'bounty' : url.includes('task-bounty') ? 'taskbounty' : 'the402';
    return responses.get(key);
  }, new Date('2026-08-03T12:00:00.000Z'));
  assert.deepEqual(result.failures, []);
  assert.equal(result.sources.length, 6);
  assert.equal(result.opportunities[0].source, 'sporeagent');
  assert.equal(result.opportunities.some((item) => item.source === 'sporeagent'), true);
});
