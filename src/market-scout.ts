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

function normalizeTimestamp(value: unknown): string {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return new Date(value < 1_000_000_000_000 ? value * 1000 : value).toISOString();
  }
  return String(value ?? '');
}

export function normalizePayanRequests(payload: unknown): MarketOpportunity[] {
  const requests = payload && typeof payload === 'object' && Array.isArray((payload as { requests?: unknown }).requests)
    ? (payload as { requests: unknown[] }).requests : [];
  return requests.flatMap((item) => {
    if (!item || typeof item !== 'object') return [];
    const record = item as Record<string, unknown>;
    if (String(record.status ?? 'open').toLowerCase() !== 'open') return [];
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

export function normalizeBountyBookJobs(payload: unknown): MarketOpportunity[] {
  const jobs = payload && typeof payload === 'object' && Array.isArray((payload as { jobs?: unknown }).jobs)
    ? (payload as { jobs: unknown[] }).jobs : [];
  return jobs.flatMap((item) => {
    if (!item || typeof item !== 'object') return [];
    const record = item as Record<string, unknown>;
    if (String(record.status ?? '').toLowerCase() !== 'open') return [];
    const capabilities = Array.isArray(record.tags) ? record.tags.map(String) : [];
    return [{
      source: 'bountybook', id: String(record.id ?? ''), title: String(record.title ?? ''),
      budgetUsd: Number(record.budget_usdc ?? 0), postedAt: normalizeTimestamp(record.created_at),
      bidCount: 0, assigned: Boolean(record.executor_address), capabilities,
    }];
  });
}

function parseThe402Price(value: unknown): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (!value || typeof value !== 'object') return 0;
  const fixed = (value as Record<string, unknown>).fixed;
  if (typeof fixed === 'number') return Number.isFinite(fixed) ? fixed : 0;
  if (typeof fixed === 'string') {
    const parsed = Number.parseFloat(fixed.replace(/[^0-9.]/g, ''));
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

export function normalizeThe402Services(payload: unknown, observedAt: Date = new Date()): MarketOpportunity[] {
  if (!Number.isFinite(observedAt.getTime())) throw new Error('invalid_market_scout_time');
  const services = payload && typeof payload === 'object' && Array.isArray((payload as { services?: unknown }).services)
    ? (payload as { services: unknown[] }).services : [];
  return services.flatMap((item) => {
    if (!item || typeof item !== 'object') return [];
    const record = item as Record<string, unknown>;
    const capabilities = [record.category, ...(Array.isArray(record.tags) ? record.tags : []), record.service_type]
      .map(String).filter((value) => value && value !== 'undefined' && value !== 'null');
    const postedAt = record.created_at ? normalizeTimestamp(record.created_at) : observedAt.toISOString();
    return [{
      source: 'the402', id: String(record.id ?? ''), title: String(record.name ?? record.title ?? ''),
      budgetUsd: parseThe402Price(record.price ?? record.price_usd), postedAt,
      bidCount: 0, assigned: false, capabilities,
    }];
  });
}

export function normalizeThe402Postings(payload: unknown): MarketOpportunity[] {
  const postings = payload && typeof payload === 'object' && Array.isArray((payload as { postings?: unknown }).postings)
    ? (payload as { postings: unknown[] }).postings : [];
  return postings.flatMap((item) => {
    if (!item || typeof item !== 'object') return [];
    const record = item as Record<string, unknown>;
    if (String(record.status ?? '').toLowerCase() !== 'open') return [];
    const assigned = Boolean(record.assigned_agent_id ?? record.awarded_agent_id ?? record.awarded_at);
    if (assigned) return [];
    const category = typeof record.category === 'string' ? record.category : '';
    const requiredTier = typeof record.required_tier === 'string' ? record.required_tier : '';
    const tags = Array.isArray(record.tags) ? record.tags.map(String) : [];
    const budgetMax = Number(record.budget_max_usd ?? record.budget_max ?? record.budget_min_usd ?? record.budget_min ?? 0);
    const createdAt = normalizeTimestamp(record.created_at);
    return [{
      source: 'the402-posting', id: String(record.id ?? record.posting_id ?? ''), title: String(record.title ?? ''),
      budgetUsd: Number.isFinite(budgetMax) ? budgetMax : 0, postedAt: createdAt,
      bidCount: Number(record.bid_count ?? 0), assigned: false,
      capabilities: [category, requiredTier, ...tags].filter(Boolean),
    }];
  });
}

export function normalizeTaskBountyTasks(payload: unknown, observedAt: Date = new Date()): MarketOpportunity[] {
  if (!Number.isFinite(observedAt.getTime())) throw new Error('invalid_market_scout_time');
  const data = payload && typeof payload === 'object' && Array.isArray((payload as { data?: unknown }).data)
    ? (payload as { data: unknown[] }).data : [];
  return data.flatMap((item) => {
    if (!item || typeof item !== 'object') return [];
    const record = item as Record<string, unknown>;
    if (String(record.status ?? 'open').toLowerCase() !== 'open') return [];
    const capabilities = [record.language, record.complexity_tag, ...(Array.isArray(record.tags) ? record.tags : [])]
      .map(String).filter((value) => value && value !== 'undefined' && value !== 'null');
    return [{
      source: 'taskbounty', id: String(record.task_id ?? record.id ?? ''), title: String(record.title ?? ''),
      budgetUsd: Number(record.bounty_cents ?? 0) / 100,
      postedAt: record.created_at ? normalizeTimestamp(record.created_at) : observedAt.toISOString(),
      bidCount: 0, assigned: false, capabilities,
    }];
  });
}

function parseOpenTaskBudget(record: Record<string, unknown>): number {
  const currency = String(record.budgetCurrency ?? '').toUpperCase();
  const text = String(record.budgetText ?? '');
  const isUsd = currency === 'USD' || currency === 'USDC' || /(?:USDC|USD|\$)/i.test(text);
  if (!isUsd) return 0;
  const amount = typeof record.budgetAmount === 'number' || typeof record.budgetAmount === 'string'
    ? Number(record.budgetAmount) : Number.NaN;
  if (Number.isFinite(amount) && amount >= 0) return amount;
  const values = [...text.replaceAll(',', '').matchAll(/\d+(?:\.\d+)?/g)].map((match) => Number(match[0]));
  return values.length ? Math.max(...values) : 0;
}

export function normalizeOpenTaskTasks(payload: unknown, observedAt: Date = new Date()): MarketOpportunity[] {
  if (!Number.isFinite(observedAt.getTime())) throw new Error('invalid_market_scout_time');
  const tasks = payload && typeof payload === 'object' && Array.isArray((payload as { tasks?: unknown }).tasks)
    ? (payload as { tasks: unknown[] }).tasks : [];
  return tasks.flatMap((item) => {
    if (!item || typeof item !== 'object') return [];
    const record = item as Record<string, unknown>;
    if (String(record.status ?? 'open').toLowerCase() !== 'open') return [];
    const postedAt = record.createdAt ? normalizeTimestamp(record.createdAt) : observedAt.toISOString();
    const capabilities = Array.isArray(record.skillsTags) ? record.skillsTags.map(String).filter(Boolean) : [];
    return [{
      source: 'opentask', id: String(record.id ?? ''), title: String(record.title ?? ''),
      budgetUsd: parseOpenTaskBudget(record), postedAt,
      bidCount: Number(record.competition?.bidCount ?? record.bidCount ?? 0),
      assigned: Boolean(record.awardDecision ?? record.awardedAgentId), capabilities,
    }].filter((opportunity) => opportunity.budgetUsd > 0);
  });
}

export function normalizeExecutionMarketTasks(payload: unknown, observedAt: Date = new Date()): MarketOpportunity[] {
  if (!Number.isFinite(observedAt.getTime())) throw new Error('invalid_market_scout_time');
  const tasks = payload && typeof payload === 'object' && Array.isArray((payload as { tasks?: unknown }).tasks)
    ? (payload as { tasks: unknown[] }).tasks : [];
  return tasks.flatMap((item) => {
    if (!item || typeof item !== 'object') return [];
    const record = item as Record<string, unknown>;
    if (String(record.status ?? 'available').toLowerCase() !== 'available') return [];
    const capabilities = [
      ...(Array.isArray(record.required_skills) ? record.required_skills : []),
      ...(Array.isArray(record.skills) ? record.skills : []),
    ].map(String).filter(Boolean);
    return [{
      source: 'execution-market', id: String(record.id ?? record.task_id ?? ''), title: String(record.title ?? record.name ?? ''),
      budgetUsd: Number(record.bounty_usd ?? record.bounty ?? 0), postedAt: record.created_at ? normalizeTimestamp(record.created_at) : observedAt.toISOString(),
      bidCount: Number(record.bid_count ?? 0), assigned: false, capabilities,
    }];
  });
}

export function normalizeRinerTasks(payload: unknown, observedAt: Date = new Date()): MarketOpportunity[] {
  if (!Number.isFinite(observedAt.getTime())) throw new Error('invalid_market_scout_time');
  const tasks = payload && typeof payload === 'object' && Array.isArray((payload as { tasks?: unknown }).tasks)
    ? (payload as { tasks: unknown[] }).tasks : [];
  return tasks.flatMap((item) => {
    if (!item || typeof item !== 'object') return [];
    const record = item as Record<string, unknown>;
    if (String(record.status ?? '').toLowerCase() !== 'published' || record.assigned_agent_id) return [];
    const capabilities = [record.category, ...(Array.isArray(record.tags) ? record.tags : [])]
      .map(String).filter((value) => value && value !== 'undefined' && value !== 'null');
    return [{
      source: 'riner', id: String(record.id ?? ''), title: String(record.title ?? ''),
      budgetUsd: String(record.budget_token ?? 'USDC').toUpperCase() === 'USDC' ? Number(record.budget_amount ?? 0) : 0,
      postedAt: record.created_at ? normalizeTimestamp(record.created_at) : observedAt.toISOString(),
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
