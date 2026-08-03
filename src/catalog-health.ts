import { validateReliabilityTarget } from './x402-reliability.ts';

export type ProbeOutcome = { httpCode?: number; error?: string };
export type CatalogHealthStatus = 'alive' | '4xx' | '5xx' | 'timeout' | 'dead';

export function catalogRequestHeaders(): Record<string, string> {
  return { accept: 'application/json', 'user-agent': 'goofy-agent-os-catalog-health/1.0' };
}

export function classifyProbe(outcome: ProbeOutcome): CatalogHealthStatus {
  if (outcome.error === 'probe_timeout') return 'timeout';
  if (typeof outcome.httpCode === 'number' && outcome.httpCode >= 200 && outcome.httpCode < 400) return 'alive';
  if (typeof outcome.httpCode === 'number' && outcome.httpCode >= 400 && outcome.httpCode < 500) return '4xx';
  if (typeof outcome.httpCode === 'number' && outcome.httpCode >= 500 && outcome.httpCode < 600) return '5xx';
  return 'dead';
}

export function offerProbeTarget(offer: Record<string, unknown>): string {
  const raw = typeof offer.endpoint === 'string' && offer.endpoint.trim()
    ? offer.endpoint.trim()
    : typeof offer.endpointUrl === 'string' && offer.endpointUrl.trim()
      ? offer.endpointUrl.trim()
      : typeof offer.buyUrl === 'string' && offer.buyUrl.trim() ? new URL(offer.buyUrl.trim(), 'https://payanagent.com').toString() : '';
  const validated = validateReliabilityTarget(raw);
  if (!validated.ok) throw new Error(validated.reason);
  return validated.url;
}
