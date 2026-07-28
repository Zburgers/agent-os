export function redactSecrets(value: string, secrets: readonly string[]): string {
  return secrets.filter(Boolean).reduce((result, secret) => result.split(secret).join('[REDACTED]'), value);
}
