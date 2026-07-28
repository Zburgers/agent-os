# Runbook

## Local deployment
1. Copy `.env.example` to an owner-managed `.env`; do not commit it.
2. Set `AGENT_OS_BIND_ADDRESS=0.0.0.0`, `AGENT_OS_PORT=9999`, and `GOOFY_DATA_DIR=/home/goofy/agent-os/data` in `.env`. PostgreSQL data will be stored at `$GOOFY_DATA_DIR/postgres`.
3. With the `rootless` Docker context selected, run `docker compose up --build -d`.
4. Confirm `curl http://127.0.0.1:9999/healthz` returns `{"status":"ok"...}`. From another private-network device, use `http://<host-private-IP>:999/healthz`.
5. The application applies migrations during startup. Run `docker compose exec app npm test` for an in-container test check.

Only the authenticated dashboard is published. PostgreSQL has no host port and is reachable solely by the application on the dedicated Compose network. Ensure the host firewall permits TCP 9999 only from the private network if a firewall is enabled.

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
