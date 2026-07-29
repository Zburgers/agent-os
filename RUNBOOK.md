# Runbook

Before operational work, read `AGENT_CONSTITUTION.md`, `AUTONOMOUS_REVENUE_MISSION.md`, `GOOFY_IDENTITY.md`, `OPERATOR_SCRATCHPAD.md`, and the active readiness/completion plans under `plans/active/`. The identity and scratchpad files preserve the owner's preferred autonomous-operator posture across sessions; they do not authorize spending, outreach, signups, contracts, or other side effects.

For AgentMail email operations, read `docs/AGENTMAIL.md` and then the current upstream docs index at https://docs.agentmail.to/llms.txt. Do not expose the API key or use email sending to bypass approval/external-message policy.

## Local deployment
1. Copy `.env.example` to an owner-managed `.env`; do not commit it.
2. Set `AGENT_OS_BIND_ADDRESS=0.0.0.0`, `AGENT_OS_PORT=9999`, and `GOOFY_DATA_DIR=/home/goofy/agent-os/data` in `.env`. PostgreSQL data will be stored at `$GOOFY_DATA_DIR/postgres`.
3. With the `rootless` Docker context selected, run `docker compose up --build -d`.
4. Confirm `curl http://127.0.0.1:9999/healthz` returns `{"status":"ok"...}`. From another private-network device, use `http://<host-private-IP>:9999/healthz`.
5. The application applies migrations during startup. Run `docker compose exec app npm test` for an in-container test check.

## Local code-change refresh

The production-style Compose services run code copied into their images; they do not mount the repository or use a file watcher. After changing application source, dependencies, migrations, the Dockerfile, or Compose configuration, refresh the running stack from this repository with:

```sh
docker compose up --build -d
```

Do not assume `docker compose restart` picks up source changes: it only restarts the existing image. Confirm the refresh with `docker compose ps` and `curl --fail http://127.0.0.1:${AGENT_OS_PORT:-9999}/healthz`.

Only the authenticated dashboard is published. PostgreSQL has no host port and is reachable solely by the application on the dedicated Compose network. Ensure the host firewall permits TCP 9999 only from the private network if a firewall is enabled.

## Operational controls
- Set `system_controls.paused` to prevent autonomous jobs; use authenticated Telegram `/pause` when configured.
- Set `system_controls.killed` to block all new side effects immediately; use authenticated Telegram `/kill` when configured.
- Use dashboard/approval API only under authenticated owner access.
- Versioned clients use `/api/v1` and supply `Idempotency-Key` for every mutation. Compatibility `/api` routes remain during migration.

## Backup and restore
- `scripts/backup.sh` creates mode-0600 PostgreSQL and curated-Markdown archives plus independent SHA-256 values in a mode-0600 manifest under `/home/goofy/agent-os/backups` by default.
- `RESTORE_TARGET_DB=goofy_restore_verify scripts/restore.sh <manifest>` verifies both checksums, restores Markdown to an isolated directory, and refuses the configured production database.
- `npm run test:restore` performs a complete isolated replacement-database restore and invariant check, then removes its temporary database and backup directory.
- `systemd/goofy-agent-os-backup.timer` runs the same checked backup daily as the `goofy` user. Enable it with `systemctl --user enable --now goofy-agent-os-backup.timer`; every successful run writes `backup_runs` and `system_health_checks` evidence in PostgreSQL.

## Recovery
On startup run abandoned-job recovery, then claim only jobs permitted by live controls. Failed jobs stop at their retry cap and become dead-letter records. Investigate via audit and job-run tables.

`npm run test:restart` kills the Compose supervisor, restarts it, and proves one recovered completion and one internal effect. `npm run experiment:internal` idempotently creates the real zero-cost readiness experiment and its checksummed evidence chain.

## Hermes

Hermes uses the native MCP, hook, skill, channel, and Mem0 facilities described
in `docs/HERMES_INTEGRATION.md`. After changing integration code, run
`hermes mcp test agent-os`, `hermes hooks doctor`, validate the risky fixture,
and restart the gateway. Never use a real channel send as a health check.
