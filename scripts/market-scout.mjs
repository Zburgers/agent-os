#!/usr/bin/env node
import { normalizeBountyBookJobs, normalizePayanRequests, rankMarketOpportunities } from '../src/market-scout.ts';

const timeoutMs = 10_000;
const capabilities = ['research', 'code', 'testing', 'automation', 'security', 'fastapi', 'web-scraping', 'data-extraction'];

async function getJson(url) {
  const response = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
  if (!response.ok) throw new Error(`${url}:http_${response.status}`);
  return response.json();
}

function sporeOpportunities(payload) {
  return (Array.isArray(payload.tasks) ? payload.tasks : []).map((task) => ({
    source: 'sporeagent', id: String(task.id ?? ''), title: String(task.title ?? ''),
    budgetUsd: Number(task.budget_usd ?? 0), postedAt: String(task.posted_at ?? ''),
    bidCount: Number(task.bid_count ?? 0), assigned: Boolean(task.assigned_agent_id),
    capabilities: Array.isArray(task.requirements) ? task.requirements.map(String) : [],
  }));
}

function payanAgentOpportunities(payload) {
  return (Array.isArray(payload.offers) ? payload.offers : []).map((offer) => ({
    source: 'payanagent', id: String(offer._id ?? ''), title: String(offer.title ?? ''),
    budgetUsd: Number(offer.priceUsd ?? 0),
    postedAt: new Date(Number(offer._creationTime ?? 0)).toISOString(),
    bidCount: Number(offer.paidAttempts ?? 0), assigned: false,
    capabilities: Array.isArray(offer.tags) ? offer.tags.map(String) : [],
  }));
}

const results = await Promise.allSettled([
  getJson('https://sporeagent.com/api/tasks?status=open').then(sporeOpportunities),
  getJson('https://payanagent.com/api/v1/offers').then(payanAgentOpportunities),
  getJson('https://payanagent.com/api/v1/requests').then(normalizePayanRequests),
  getJson('https://api.bountybook.ai/jobs?status=open&limit=20').then(normalizeBountyBookJobs),
]);
const opportunities = results.flatMap((result) => result.status === 'fulfilled' ? result.value : []);
const failures = results.flatMap((result) => result.status === 'rejected' ? [String(result.reason?.message ?? result.reason)] : []);
const ranked = rankMarketOpportunities(opportunities, new Date(), capabilities).slice(0, 20);
console.log(JSON.stringify({ generatedAt: new Date().toISOString(), sources: ['sporeagent', 'payanagent/offers', 'payanagent/requests', 'bountybook/jobs'], opportunities: ranked, failures }, null, 2));
