import { normalizeBountyBookJobs, normalizeExecutionMarketTasks, normalizePayanRequests, normalizeRinerTasks, normalizeTaskBountyTasks, normalizeThe402Postings, normalizeThe402Services, rankMarketOpportunities } from './market-scout.ts';

const timeoutMs = 10_000;
const capabilities = ['research', 'code', 'testing', 'automation', 'security', 'fastapi', 'web-scraping', 'data-extraction'];

type FetchJson = (url: string) => Promise<unknown>;

async function publicJson(url: string): Promise<unknown> {
  const response = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
  if (!response.ok) throw new Error(`${url}:http_${response.status}`);
  return response.json();
}

function sporeOpportunities(payload: any) {
  return (Array.isArray(payload?.tasks) ? payload.tasks : []).map((task: any) => ({
    source: 'sporeagent', id: String(task.id ?? ''), title: String(task.title ?? ''),
    budgetUsd: Number(task.budget_usd ?? 0), postedAt: String(task.posted_at ?? ''),
    bidCount: Number(task.bid_count ?? 0), assigned: Boolean(task.assigned_agent_id),
    capabilities: Array.isArray(task.requirements) ? task.requirements.map(String) : [],
  }));
}

function payanAgentOpportunities(payload: any) {
  return (Array.isArray(payload?.offers) ? payload.offers : []).map((offer: any) => ({
    source: 'payanagent', id: String(offer._id ?? ''), title: String(offer.title ?? ''),
    budgetUsd: Number(offer.priceUsd ?? 0), postedAt: new Date(Number(offer._creationTime ?? 0)).toISOString(),
    bidCount: Number(offer.paidAttempts ?? 0), assigned: false,
    capabilities: Array.isArray(offer.tags) ? offer.tags.map(String) : [],
  }));
}

export async function runRevenueMarketScout(fetchJson: FetchJson = publicJson, now = new Date()) {
  const results = await Promise.allSettled([
    fetchJson('https://sporeagent.com/api/tasks?status=open').then(sporeOpportunities),
    fetchJson('https://payanagent.com/api/v1/offers').then(payanAgentOpportunities),
    fetchJson('https://payanagent.com/api/v1/requests').then(normalizePayanRequests),
    fetchJson('https://api.bountybook.ai/jobs?status=open&limit=20').then(normalizeBountyBookJobs),
    fetchJson('https://api.the402.ai/v1/services/catalog?limit=100').then((payload) => normalizeThe402Services(payload, now)),
    fetchJson('https://api.the402.ai/v1/postings?cursor=now').then(normalizeThe402Postings),
    fetchJson('https://www.task-bounty.com/api/v1/tasks').then((payload) => normalizeTaskBountyTasks(payload, now)),
    fetchJson('https://api.execution.market/api/v1/tasks/available?target_executor_type=agent&min_bounty=1&limit=50').then((payload) => normalizeExecutionMarketTasks(payload, now)),
    fetchJson('https://api.riner.io/api/v1/tasks').then((payload) => normalizeRinerTasks(payload, now)),
  ]);
  const opportunities = results.flatMap((result) => result.status === 'fulfilled' ? result.value : []);
  const failures = results.flatMap((result) => result.status === 'rejected' ? [String(result.reason?.message ?? result.reason)] : []);
  const ranked = rankMarketOpportunities(opportunities, now, capabilities);
  const selected = ranked.filter((item, index, all) => all.findIndex((candidate) => candidate.source === item.source) === index);
  for (const item of ranked) {
    if (selected.length >= 20) break;
    if (!selected.includes(item)) selected.push(item);
  }
  return {
    generatedAt: now.toISOString(),
    sources: ['sporeagent', 'payanagent/offers', 'payanagent/requests', 'bountybook/jobs', 'the402/services/catalog', 'the402/postings', 'taskbounty/tasks', 'execution-market/tasks', 'riner/tasks'],
    opportunities: selected.slice(0, 20),
    failures,
  };
}
