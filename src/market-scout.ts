export type MarketOpportunity = {
  source: string;
  id: string;
  title: string;
  budgetUsd: number;
  postedAt: string;
  bidCount: number;
  assigned: boolean;
  capabilities: string[];
};

export type RankedMarketOpportunity = MarketOpportunity & { score: number };

export function normalizePayanRequests(payload: unknown): MarketOpportunity[] {
  const requests = payload && typeof payload === 'object' && Array.isArray((payload as { requests?: unknown }).requests)
    ? (payload as { requests: unknown[] }).requests : [];
  return requests.flatMap((item) => {
    if (!item || typeof item !== 'object') return [];
    const record = item as Record<string, unknown>;
    if (String(record.status ?? '').toLowerCase() !== 'open') return [];
    const description = String(record.description ?? '');
    const postedAt = new Date(Number(record._creationTime ?? 0));
    const capabilities = [...description.matchAll(/\[([^\]]+)\]/g)]
      .flatMap((match) => match[1].split(/[·,]/).map((part) => part.trim().toLowerCase()))
      .filter(Boolean);
    return [{
      source: 'payanagent-request', id: String(record._id ?? ''), title: String(record.title ?? ''),
      budgetUsd: Number(record.budgetMaxCents ?? 0) / 100, postedAt: postedAt.toISOString(),
      bidCount: 0, assigned: false, capabilities,
    }];
  });
}

function validateOpportunity(item: MarketOpportunity): void {
  if (!item.source.trim() || !item.id.trim() || !item.title.trim()
    || !Number.isFinite(item.budgetUsd) || item.budgetUsd < 0
    || !Number.isInteger(item.bidCount) || item.bidCount < 0
    || !Array.isArray(item.capabilities) || !item.capabilities.every((capability) => typeof capability === 'string')
    || !Number.isFinite(Date.parse(item.postedAt))) {
    throw new Error('invalid_market_opportunity');
  }
}

export function rankMarketOpportunities(
  opportunities: MarketOpportunity[],
  now: Date = new Date(),
  capabilities: string[] = [],
): RankedMarketOpportunity[] {
  if (!Number.isFinite(now.getTime())) throw new Error('invalid_market_scout_time');
  const wanted = new Set(capabilities.map((capability) => capability.trim().toLowerCase()).filter(Boolean));
  return opportunities.map((item) => {
    validateOpportunity(item);
    const ageDays = Math.max(0, (now.getTime() - Date.parse(item.postedAt)) / 86_400_000);
    const freshness = Math.max(0, 180 - ageDays) * 2;
    const matchCount = item.capabilities.filter((capability) => wanted.has(capability.toLowerCase())).length;
    const score = item.budgetUsd + freshness + matchCount * 40 - item.bidCount * 5 - (item.assigned ? 1_000 : 0);
    return { ...item, score: Math.round(score * 100) / 100 };
  }).sort((left, right) => right.score - left.score || left.source.localeCompare(right.source) || left.id.localeCompare(right.id));
}
