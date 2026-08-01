import { validateReliabilityTarget } from './x402-reliability.ts';

export const MAX_REQUEST_BYTES = 4096;

export function parseCheckRequest(raw: string): { target: string } {
  if (typeof raw !== 'string' || Buffer.byteLength(raw, 'utf8') > MAX_REQUEST_BYTES) throw new Error('invalid_request');
  let parsed: unknown;
  try { parsed = JSON.parse(raw); } catch { throw new Error('invalid_request'); }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('invalid_request');
  const record = parsed as Record<string, unknown>;
  if (Object.keys(record).length !== 1 || typeof record.target !== 'string') throw new Error('invalid_request');
  const target = validateReliabilityTarget(record.target);
  if (!target.ok) throw new Error('invalid_target');
  return { target: target.url };
}
