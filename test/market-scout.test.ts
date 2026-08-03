import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizePayanRequests, rankMarketOpportunities, type MarketOpportunity } from '../src/market-scout.ts';

test('market scout prioritizes fresh, unassigned, capability-matched paid work', () => {
  const opportunities: MarketOpportunity[] = [
    { source: 'sporeagent', id: 'stale', title: 'Old task', budgetUsd: 200, postedAt: '2026-03-01T00:00:00.000Z', bidCount: 1, assigned: false, capabilities: ['testing'] },
    { source: 'sporeagent', id: 'fresh', title: 'Fresh task', budgetUsd: 80, postedAt: '2026-08-02T00:00:00.000Z', bidCount: 2, assigned: false, capabilities: ['testing', 'fastapi'] },
    { source: 'near', id: 'assigned', title: 'Assigned task', budgetUsd: 500, postedAt: '2026-08-02T00:00:00.000Z', bidCount: 0, assigned: true, capabilities: ['testing'] },
  ];

  assert.deepEqual(rankMarketOpportunities(opportunities, new Date('2026-08-03T00:00:00.000Z'), ['testing', 'fastapi']).map((item) => item.id), ['fresh', 'stale', 'assigned']);
});

test('market scout rejects malformed opportunity records before ranking', () => {
  assert.throws(() => rankMarketOpportunities([{ source: 'sporeagent', id: '', title: 'bad', budgetUsd: -1, postedAt: 'bad', bidCount: 0, assigned: false, capabilities: [] }], new Date(), []), /invalid_market_opportunity/);
});

test('market scout extracts paid PayanAgent requests as actionable bounty opportunities', () => {
  const [request] = normalizePayanRequests({ requests: [{
    _id: 'request-1', title: 'Build endpoint health checker', budgetMaxCents: 4,
    status: 'open', _creationTime: Date.parse('2026-08-03T00:00:00.000Z'),
    description: '[tooling] probe endpoints and report latency',
  }] });
  assert.deepEqual(request, {
    source: 'payanagent-request', id: 'request-1', title: 'Build endpoint health checker',
    budgetUsd: 0.04, postedAt: '2026-08-03T00:00:00.000Z', bidCount: 0, assigned: false,
    capabilities: ['tooling'],
  });
});
