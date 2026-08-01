import { isIP } from 'node:net';
import { promises as dns } from 'node:dns';
import https from 'node:https';

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

export function isPublicAddress(address: string): boolean {
  const kind = isIP(address);
  if (kind === 4) return !isPrivateIpv4(address);
  if (kind === 6) {
    const normalized = address.toLowerCase();
    return normalized !== '::1' && !normalized.startsWith('fc') && !normalized.startsWith('fd') && !normalized.startsWith('fe80:');
  }
  return false;
}

type LookupAddress = { address: string; family: number };
type Lookup = (hostname: string, options: { all: true; verbatim: true }) => Promise<LookupAddress[]>;

export async function resolvePublicAddresses(hostname: string, lookup: Lookup = (name, options) => dns.lookup(name, options)) {
  const records = await lookup(hostname, { all: true, verbatim: true });
  const addresses = [...new Set(records.map((record) => record.address))];
  if (addresses.length === 0 || addresses.some((address) => !isPublicAddress(address))) throw new Error('private_target');
  return addresses;
}

export async function probeReliabilityTarget(
  input: string,
  options: { lookup?: Lookup; timeout_ms?: number } = {},
): Promise<ReliabilityReport> {
  const target = validateReliabilityTarget(input);
  if (!target.ok) throw new Error(target.reason);
  const parsed = new URL(target.url);
  const addresses = await resolvePublicAddresses(parsed.hostname, options.lookup);
  const address = addresses[0];
  const timeoutMs = options.timeout_ms ?? 5000;
  if (!Number.isInteger(timeoutMs) || timeoutMs < 250 || timeoutMs > 15000) throw new Error('invalid_timeout');
  const started = Date.now();

  return await new Promise((resolve, reject) => {
    const request = https.request({
      hostname: address,
      port: parsed.port ? Number(parsed.port) : 443,
      path: `${parsed.pathname}${parsed.search}`,
      method: 'HEAD',
      headers: { host: parsed.host },
      servername: parsed.hostname,
      timeout: timeoutMs,
    }, (response) => {
      response.resume();
      const retryAfter = response.headers['retry-after'];
      const retryAfterMs = typeof retryAfter === 'string' && /^\d+$/.test(retryAfter) ? Number(retryAfter) * 1000 : null;
      resolve(createReliabilityReport({
        target: target.url,
        status: response.statusCode ?? 0,
        latency_ms: Date.now() - started,
        content_type: response.headers['content-type'] ?? null,
        retry_after_ms: retryAfterMs,
      }));
    });
    request.once('timeout', () => request.destroy(new Error('probe_timeout')));
    request.once('error', reject);
    request.end();
  });
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
