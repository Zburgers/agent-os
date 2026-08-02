export type NearBidStatus = {
  id: string;
  jobId: string;
  status: string;
  amount: string;
  budgetToken: string;
};

type FetchLike = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

function bidItems(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    if (Array.isArray(record.items)) return record.items;
    if (Array.isArray(record.bids)) return record.bids;
  }
  return [];
}

export async function fetchNearBidStatus(input: {
  bidId: string;
  apiKey: string;
  fetchImpl?: FetchLike;
  signal?: AbortSignal;
}): Promise<NearBidStatus> {
  if (!/^[0-9a-f-]{36}$/i.test(input.bidId)) throw new Error('invalid_near_bid_id');
  if (!input.apiKey.trim()) throw new Error('near_api_key_unavailable');
  const response = await (input.fetchImpl ?? fetch)('https://market.near.ai/v1/bids/mine', {
    headers: { authorization: `Bearer ${input.apiKey}` },
    signal: input.signal,
  });
  if (!response.ok) throw new Error(`near_market_http_${response.status}`);
  const payload = await response.json() as unknown;
  const raw = bidItems(payload).find((item) => item && typeof item === 'object'
    && String((item as Record<string, unknown>).bid_id ?? (item as Record<string, unknown>).id) === input.bidId);
  if (!raw || typeof raw !== 'object') throw new Error('near_bid_not_found');
  const bid = raw as Record<string, unknown>;
  const status = String(bid.status ?? '').trim().toLowerCase();
  if (!/^[a-z][a-z0-9_-]{0,31}$/.test(status)) throw new Error('near_bid_status_invalid');
  return {
    id: input.bidId,
    jobId: String(bid.job_id ?? ''),
    status,
    amount: String(bid.amount ?? ''),
    budgetToken: String(bid.budget_token ?? ''),
  };
}

export function shouldAlertForBidStatus(previousStatus: string | undefined, currentStatus: string) {
  return currentStatus !== 'pending' && currentStatus !== previousStatus;
}

type CredentialDependencies = {
  statImpl?: (path: string) => Promise<{ isFile(): boolean; mode: number }>;
  readFileImpl?: (path: string, encoding: BufferEncoding) => Promise<string>;
};

export async function loadNearAgentCredential(path: string, dependencies: CredentialDependencies = {}) {
  if (!isAbsolute(path)) throw new Error('near_credential_path');
  const metadata = await (dependencies.statImpl ?? stat)(path);
  if (!metadata.isFile()) throw new Error('near_credential_type');
  if ((metadata.mode & 0o077) !== 0) throw new Error('near_credential_permissions');
  const value = JSON.parse(await (dependencies.readFileImpl ?? readFile)(path, 'utf8')) as Record<string, unknown>;
  const apiKey = String(value.api_key ?? '').trim();
  if (!apiKey || apiKey.length > 4096) throw new Error('near_api_key_unavailable');
  return { apiKey };
}
import { isAbsolute } from 'node:path';
import { readFile, stat } from 'node:fs/promises';
