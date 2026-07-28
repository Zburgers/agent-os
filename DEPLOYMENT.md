# Deployment Record

Deployment target: local Docker Compose on the owner-controlled Goofy host, using the `rootless` Docker context only. The authenticated dashboard is published. Browser access uses HTTP Basic authentication with username `owner` and the owner dashboard token as its password. to the private network on TCP 9999; PostgreSQL has no published port and remains private to the dedicated Compose network. Persistent PostgreSQL state is bind-mounted under `/home/goofy/agent-os/data`. No public exposure, payments, outreach, commercial accounts, or real spending are enabled by this deployment.

Promotion gate: migrations, authentication/authorization, approval boundaries, financial limits/reserve, immutable ledger, idempotency, Telegram allowlist, pause/kill, restart recovery, scoped memory, secret redaction, backup/restore, and health checks must pass. A public or hosted deployment requires a separate owner-approved target and configured credentials.
