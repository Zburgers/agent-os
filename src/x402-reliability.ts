import { isIP } from 'node:net';

export type ReliabilityTargetResult =
  | { ok: true; url: string }
  | { ok: false; reason: string };

export type ReliabilityReport = {
  schema_version: '1';
  target: string;
  status: number;
  latency_ms: number;
  content_type: string | null;
  retry_after_ms: number | null;
};

function isPrivateIpv4(hostname: string): boolean {
  const octets = hostname.split('.').map(Number);
  if (octets.length !== 4 || octets.some((value) => !Number.isInteger(value) || value < 0 || value > 255)) return true;
  const [a, b] = octets;
  return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168);
}

function isPrivateHostname(hostname: string): boolean {
  const normalized = hostname.toLowerCase().replace(/\.$/, '');
  if (normalized === 'localhost' || normalized.endsWith('.localhost') || normalized.endsWith('.local')) return true;
  const kind = isIP(normalized);
  if (kind === 4) return isPrivateIpv4(normalized);
  if (kind === 6) return normalized === '::1' || normalized.startsWith('fc') || normalized.startsWith('fd') || normalized.startsWith('fe80:');
  return false;
}

export function validateReliabilityTarget(input: string): ReliabilityTargetResult {
  if (typeof input !== 'string' || input.length === 0 || input.length > 2048) return { ok: false, reason: 'invalid_target' };
  let parsed: URL;
  try { parsed = new URL(input); } catch { return { ok: false, reason: 'invalid_target' }; }
  if (parsed.protocol !== 'https:' || parsed.username || parsed.password || parsed.port === '0') return { ok: false, reason: 'https_required' };
  if (!parsed.hostname || isPrivateHostname(parsed.hostname)) return { ok: false, reason: 'private_target' };
  return { ok: true, url: parsed.toString() };
}

export function createReliabilityReport(input: Omit<ReliabilityReport, 'schema_version'>): ReliabilityReport {
  return {
    schema_version: '1',
    target: input.target,
    status: input.status,
    latency_ms: input.latency_ms,
    content_type: input.content_type,
    retry_after_ms: input.retry_after_ms,
  };
}
