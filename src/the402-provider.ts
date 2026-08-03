import { createHmac, timingSafeEqual } from 'node:crypto';

type HeaderValue = string | string[] | undefined;

function header(headers: Record<string, HeaderValue>, name: string): string {
  const value = headers[name] ?? headers[Object.keys(headers).find((key) => key.toLowerCase() === name.toLowerCase()) ?? ''];
  return Array.isArray(value) ? String(value[0] ?? '') : String(value ?? '');
}

export function createThe402WebhookSignature(timestamp: string, rawBody: string, webhookSecret: string): string {
  return createHmac('sha256', webhookSecret).update(`${timestamp}.${rawBody}`).digest('hex');
}

export function verifyThe402Webhook(
  headers: Record<string, HeaderValue>,
  rawBody: string,
  config: { apiKey: string; webhookSecret: string; nowSeconds?: number },
): boolean {
  const platformSecret = header(headers, 'x-platform-secret');
  const timestamp = header(headers, 'x-webhook-timestamp');
  const supplied = header(headers, 'x-webhook-signature').replace(/^sha256=/, '');
  const timestampSeconds = Number(timestamp);
  const nowSeconds = config.nowSeconds ?? Math.floor(Date.now() / 1000);
  if (!config.apiKey || !config.webhookSecret || platformSecret !== config.apiKey
    || !/^\d+$/.test(timestamp) || !Number.isInteger(timestampSeconds)
    || Math.abs(nowSeconds - timestampSeconds) > 300 || !/^[0-9a-f]{64}$/i.test(supplied)) return false;
  const expected = createThe402WebhookSignature(timestamp, rawBody, config.webhookSecret);
  return timingSafeEqual(Buffer.from(supplied.toLowerCase(), 'hex'), Buffer.from(expected, 'hex'));
}

export function parseThe402Job(rawBody: string, expectedServiceId: string): {
  jobId: string; serviceId: string; target: string; callbackUrl: string;
} {
  let payload: unknown;
  try { payload = JSON.parse(rawBody); } catch { throw new Error('the402_invalid_json'); }
  if (!payload || typeof payload !== 'object') throw new Error('the402_invalid_job');
  const record = payload as Record<string, unknown>;
  const jobId = String(record.job_id ?? '');
  const serviceId = String(record.service_id ?? '');
  const brief = record.brief && typeof record.brief === 'object' ? record.brief as Record<string, unknown> : {};
  const target = String(brief.target ?? '');
  const callbackUrl = String(record.callback_url ?? '');
  if (record.type !== 'job_dispatch' || !jobId || !serviceId || serviceId !== expectedServiceId
    || !/^https:\/\//.test(target) || !/^https:\/\/api\.the402\.ai\//.test(callbackUrl)) {
    throw new Error(serviceId !== expectedServiceId ? 'the402_service_mismatch' : 'the402_invalid_job');
  }
  return { jobId, serviceId, target, callbackUrl };
}
