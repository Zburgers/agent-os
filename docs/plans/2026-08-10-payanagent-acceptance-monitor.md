# PayanAgent acceptance monitor

## Goal

Preserve the chance of collecting the already-approved escrow-backed PayanAgent
catalog-health bounty by detecting request or Goofy-bid state changes promptly.

## Boundaries

- Read-only `GET /api/v1/requests/:id` every five minutes.
- Use the existing protected PayanAgent provider credential only in memory.
- Persist a redacted job effect and audit event through the existing Agent OS
  worker transaction.
- Enqueue the existing owner Telegram success notification only when a request
  or Goofy bid transitions away from its previous state.
- Never bid, accept, fulfill, approve, cancel, buy, sign, broadcast, or spend.
- No endpoint, credential, raw bid message, or wallet material is copied into
  PostgreSQL, logs, Markdown, Telegram, or MCP output.

## State model

The monitor normalizes the request status, escrow amount, and only the Goofy
provider's bid IDs/statuses. Previous completed job output is the comparison
baseline. The first observation is recorded without alerting; subsequent
changes alert once per occurrence through the existing idempotent outbox.

## Failure behavior

Invalid credentials, malformed provider responses, non-2xx responses, timeouts,
or unexpected status values fail the job and use the existing retry/dead-letter
path. No external mutation is attempted on failure.

## Verification

Unit tests cover credential permissions, response normalization, malformed data,
and transition detection. Build, lint-equivalent `git diff --check`, migration,
and the existing test suite must pass before shipping.
