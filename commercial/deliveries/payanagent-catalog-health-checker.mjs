#!/usr/bin/env node

// Dependency-free, non-paying PayanAgent catalog liveness checker.
// The measured surface is the public buy gateway when seller endpoints are
// redacted; it never sends payment headers or request bodies.

const catalog = 'https://payanagent.com/api/v1/offers';
const maxOffers = Math.min(Number(process.env.LIMIT ?? 100), 100);
const timeoutMs = Math.min(Number(process.env.TIMEOUT_MS ?? 5000), 10000);
const concurrency = Math.min(Number(process.env.CONCURRENCY ?? 8), 12);

async function getPage(cursor) {
  const url = new URL(catalog);
  url.searchParams.set('sort', 'top');
  url.searchParams.set('limit', String(Math.min(maxOffers, 100)));
  if (cursor) url.searchParams.set('cursor', cursor);
  const response = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
  if (!response.ok) throw new Error(`catalog_http_${response.status}`);
  return response.json();
}

async function loadOffers() {
  const offers = [];
  let cursor;
  do {
    const page = await getPage(cursor);
    for (const offer of Array.isArray(page.offers) ? page.offers : []) {
      if (offers.length >= maxOffers) break;
      offers.push(offer);
    }
    cursor = offers.length < maxOffers && page.nextCursor ? String(page.nextCursor) : '';
  } while (cursor);
  return offers;
}

function targetFor(offer) {
  const endpoint = typeof offer.endpoint === 'string' ? offer.endpoint : '';
  if (endpoint) return endpoint;
  const buyUrl = typeof offer.buyUrl === 'string' ? offer.buyUrl : '';
  return buyUrl ? new URL(buyUrl, 'https://payanagent.com').href : null;
}

function classify(httpCode, error) {
  if (error === 'timeout') return 'timeout';
  if (error) return 'dead';
  if (httpCode >= 200 && httpCode < 400) return 'alive';
  // 401/402/403/405 prove a reachable, payment/auth/method-gated gateway.
  if ([401, 402, 403, 405].includes(httpCode)) return 'alive';
  if (httpCode >= 400 && httpCode < 500) return '4xx';
  if (httpCode >= 500) return '5xx';
  return 'dead';
}

async function probe(offer) {
  const endpoint = targetFor(offer);
  const base = { offerId: String(offer._id ?? ''), title: String(offer.title ?? ''), endpoint };
  if (!endpoint) return { ...base, status: 'dead', httpCode: null, latencyMs: null };
  const started = performance.now();
  try {
    const response = await fetch(endpoint, {
      method: 'HEAD',
      redirect: 'manual',
      signal: AbortSignal.timeout(timeoutMs),
    });
    const latencyMs = Math.round(performance.now() - started);
    return { ...base, status: classify(response.status), httpCode: response.status, latencyMs };
  } catch (error) {
    const latencyMs = Math.round(performance.now() - started);
    const message = String(error?.name === 'TimeoutError' ? 'timeout' : error?.message ?? error);
    return { ...base, status: classify(null, message === 'timeout' ? 'timeout' : message), httpCode: null, latencyMs };
  }
}

async function mapBounded(items, workerCount) {
  const results = new Array(items.length);
  let next = 0;
  async function worker() {
    while (true) {
      const index = next++;
      if (index >= items.length) return;
      results[index] = await probe(items[index]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(workerCount, items.length) }, worker));
  return results;
}

const offers = await loadOffers();
const results = await mapBounded(offers, concurrency);
const nonAlive = results.filter((result) => result.status !== 'alive');
const summary = [
  `Checked ${results.length} public offer gateways with unauthenticated HEAD probes; no paid calls were made.`,
  `Alive/reachable: ${results.filter((result) => result.status === 'alive').length}; non-alive: ${nonAlive.length}.`,
  nonAlive.length ? `Non-alive: ${nonAlive.map((result) => `${result.title || result.offerId} (${result.status})`).join('; ')}.` : 'No non-alive gateways observed.',
  'Evidence boundary: seller endpoints may be redacted; endpoint fields identify the public buy gateway that was measured.',
].join(' ');
console.log(JSON.stringify({ generatedAt: new Date().toISOString(), paidCalls: 0, results, markdownSummary: `# PayanAgent catalog health\n\n${summary}` }, null, 2));
