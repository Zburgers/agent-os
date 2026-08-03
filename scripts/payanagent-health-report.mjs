#!/usr/bin/env node
import { catalogRequestHeaders, classifyProbe, offerProbeTarget } from '../src/catalog-health.ts';
import { probeReliabilityTarget } from '../src/x402-reliability.ts';

const baseUrl = 'https://payanagent.com/api/v1/offers';
const limit = 100;
const timeoutMs = 5_000;

async function getPage(cursor, pageLimit) {
  const params = new URLSearchParams({ sort: 'top', limit: String(pageLimit) });
  if (cursor) params.set('cursor', cursor);
  const response = await fetch(`${baseUrl}?${params}`, { headers: catalogRequestHeaders(), signal: AbortSignal.timeout(timeoutMs) });
  if (!response.ok) throw new Error(`catalog_http_${response.status}`);
  return response.json();
}

const offers = [];
let cursor;
let fetchError = null;
try {
  do {
    const page = await getPage(cursor, Math.min(limit - offers.length, 100));
    if (!Array.isArray(page.offers)) throw new Error('catalog_offers_invalid');
    offers.push(...page.offers);
    if (offers.length >= limit) break;
    cursor = typeof page.nextCursor === 'string' && page.nextCursor ? page.nextCursor : undefined;
  } while (cursor);
} catch (error) {
  fetchError = String(error?.message ?? error);
}

if (fetchError) {
  console.log(JSON.stringify({
    generatedAt: new Date().toISOString(), probeMethod: 'HEAD', paidCalls: 0, results: [],
    failures: [fetchError], markdownSummary: `# PayanAgent catalog health\n\nCatalog fetch failed before probing: ${fetchError}. No paid calls were made.`,
  }, null, 2));
  process.exit(0);
}

const results = await Promise.all(offers.slice(0, 100).map(async (offer) => {
  const offerId = String(offer._id ?? '');
  const title = String(offer.title ?? '');
  let endpoint;
  try {
    endpoint = offerProbeTarget(offer);
    const report = await probeReliabilityTarget(endpoint, { timeout_ms: timeoutMs });
    return { offerId, title, endpoint, status: classifyProbe({ httpCode: report.status }), httpCode: report.status, latencyMs: report.latency_ms };
  } catch (error) {
    const message = String(error?.message ?? error);
    return { offerId, title, endpoint: endpoint ?? null, status: classifyProbe({ error: message }), httpCode: null, latencyMs: null };
  }
}));

const dead = results.filter((result) => result.status !== 'alive');
const summary = [
  `Probed ${results.length} offers with non-paying HEAD requests.`,
  `Alive: ${results.filter((result) => result.status === 'alive').length}; dead: ${dead.length}.`,
  dead.length ? `Non-alive offers: ${dead.slice(0, 20).map((result) => `${result.title || result.offerId} (${result.status})`).join('; ')}.` : 'No non-alive offers were observed.',
].join(' ');
console.log(JSON.stringify({ generatedAt: new Date().toISOString(), probeMethod: 'HEAD', paidCalls: 0, results, failures: [], markdownSummary: `# PayanAgent catalog health\n\n${summary}` }, null, 2));
