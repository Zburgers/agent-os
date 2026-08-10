import { isAbsolute } from 'node:path';
import { readFile, stat } from 'node:fs/promises';

export type PayanAgentBidStatus = { id: string; status: string };
export type PayanAgentRequestStatus = {
  requestId: string;
  title: string;
  requestStatus: string;
  budgetMaxCents: number | null;
  escrowDepositedCents: number | null;
  ownBids: PayanAgentBidStatus[];
};

type FetchLike = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;
type CredentialDependencies = {
  statImpl?: (path: string) => Promise<{ isFile(): boolean; mode: number }>;
  readFileImpl?: (path: string, encoding: BufferEncoding) => Promise<string>;
};

const statusPattern = /^[a-z][a-z0-9_-]{0,31}$/;

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function boundedInteger(value: unknown, field: string) {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 0 || parsed > 1_000_000_000) throw new Error(`payanagent_${field}_invalid`);
  return parsed;
}

function bidItems(value: unknown) {
  if (Array.isArray(value)) return value;
  const object = record(value);
  return Array.isArray(object.bids) ? object.bids : [];
}

export async function fetchPayanAgentRequestStatus(input: {
  requestId: string;
  apiKey: string;
  providerId: string;
  fetchImpl?: FetchLike;
  signal?: AbortSignal;
}): Promise<PayanAgentRequestStatus> {
  if (!/^[a-z0-9]{20,64}$/.test(input.requestId)) throw new Error('payanagent_request_id_invalid');
  if (!input.apiKey.trim()) throw new Error('payanagent_api_key_unavailable');
  if (!input.providerId.trim()) throw new Error('payanagent_provider_id_unavailable');
  const response = await (input.fetchImpl ?? fetch)(`https://payanagent.com/api/v1/requests/${encodeURIComponent(input.requestId)}`, {
    headers: { authorization: `Bearer ${input.apiKey}` },
    signal: input.signal,
  });
  if (!response.ok) throw new Error(`payanagent_http_${response.status}`);
  const payload = record(await response.json());
  const request = record(payload.request ?? payload);
  const requestId = String(request._id ?? request.id ?? input.requestId);
  const title = String(request.title ?? '').trim();
  const requestStatus = String(request.status ?? '').trim().toLowerCase();
  if (requestId !== input.requestId || !title || !statusPattern.test(requestStatus)) throw new Error('payanagent_request_status_invalid');
  const ownBids = bidItems(payload.bids ?? request.bids).flatMap((item): PayanAgentBidStatus[] => {
    const bid = record(item);
    if (String(bid.bidderId ?? bid.bidder_id ?? '') !== input.providerId) return [];
    const id = String(bid._id ?? bid.id ?? '');
    const status = String(bid.status ?? '').trim().toLowerCase();
    if (!/^[a-z0-9_-]{6,80}$/.test(id) || !statusPattern.test(status)) throw new Error('payanagent_bid_status_invalid');
    return [{ id, status }];
  });
  ownBids.sort((left, right) => left.id.localeCompare(right.id));
  return {
    requestId,
    title: title.slice(0, 200),
    requestStatus,
    budgetMaxCents: boundedInteger(request.budgetMaxCents ?? request.budget_max_cents, 'budget'),
    escrowDepositedCents: boundedInteger(request.escrowDepositedCents ?? request.escrow_deposited_cents, 'escrow'),
    ownBids,
  };
}

function ownBidFingerprint(value: PayanAgentRequestStatus) {
  return value.ownBids.map((bid) => `${bid.id}:${bid.status}`).join('|');
}

export function shouldAlertForPayanAgentStatus(previous: PayanAgentRequestStatus | undefined, current: PayanAgentRequestStatus) {
  if (!previous) return false;
  return previous.requestStatus !== current.requestStatus || ownBidFingerprint(previous) !== ownBidFingerprint(current);
}

export async function loadPayanAgentCredential(path: string, dependencies: CredentialDependencies = {}) {
  if (!isAbsolute(path)) throw new Error('payanagent_credential_path');
  const metadata = await (dependencies.statImpl ?? stat)(path);
  if (!metadata.isFile()) throw new Error('payanagent_credential_type');
  if ((metadata.mode & 0o077) !== 0) throw new Error('payanagent_credential_permissions');
  const value = record(JSON.parse(await (dependencies.readFileImpl ?? readFile)(path, 'utf8')));
  const apiKey = String(value.api_key ?? '').trim();
  const providerId = String(value.agent_id ?? '').trim();
  if (!apiKey || apiKey.length > 4096) throw new Error('payanagent_api_key_unavailable');
  if (!/^[a-z0-9]{20,64}$/.test(providerId)) throw new Error('payanagent_provider_id_invalid');
  return { apiKey, providerId };
}
