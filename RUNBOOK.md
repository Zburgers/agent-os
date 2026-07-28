# Runbook

## Local deployment
1. Copy `.env.example` to an owner-managed `.env`; do not commit it.
2. Run `docker compose up --build -d`.
3. Confirm `curl http://localhost:3000/healthz` returns `{"status":"ok"...}`.
4. Run `docker compose exec app npm test` and `npm run migrate` as applicable.

## Operational controls
- Set `system_controls.paused` to prevent autonomous jobs; use authenticated Telegram `/pause` when configured.
- Set `system_controls.killed` to block all new side effects immediately; use authenticated Telegram `/kill` when configured.
- Use dashboard/approval API only under authenticated owner access.

## Backup and restore
- `scripts/backup.sh` creates a timestamped PostgreSQL dump in the owner-controlled backup directory.
- Restore only into a stopped/replacement database with `scripts/restore.sh <dump>`, then run readiness checks.
- Restore testing is mandatory before revenue operations.

## Recovery
On startup run abandoned-job recovery, then claim only jobs permitted by live controls. Failed jobs stop at their retry cap and become dead-letter records. Investigate via audit and job-run tables.
