Hi James,

1. For the finished-sign photo flow, I would require a job ID, QR code, or an
explicit bot selection before accepting the photo. The Telegram webhook gives
n8n the `file_id`, `message_id`, sender, and timestamp; n8n can download the
image, store it under a deterministic job-keyed path, and write the URL,
checksum, and source message ID to the matching monday.com item. Missing or
ambiguous matches go to a small human review step instead of letting an agent
guess, and repeated Telegram message IDs are ignored idempotently.

2. Closest relevant build:
https://github.com/Zburgers/agent-os — a self-hosted PostgreSQL-backed agent
control plane running on Linux with system services, scoped secrets, Telegram
controls, durable jobs, approval/effect guards, audit history, health checks,
restart recovery, backups, and a kill switch. I can also provide a sanitized
screen recording of the running system before any VPS access is exchanged.

3. Fixed trial quote: USD 249 for the fresh-host scope, including the pinned
OpenClaw install, dedicated non-sudo user, systemd unit, SSH/UFW/fail2ban
hardening, loopback binding, verification evidence, a short runbook, and one
sanitized screen recording. Ongoing work: USD 45/hour with a separately agreed
cap.

4. Time zone: UTC+5:30. I usually respond to an urgent issue within four working
hours and otherwise within one business day; I am not representing this as
24/7 pager coverage.

I would first confirm the exact OpenClaw source/version, the allowed SSH recovery
path, and acceptance checks. I would keep credentials out of shell history and
unit files, and I would not disable the provider's recovery access until the
key-only login path has been tested in a second session.

Regards,
Goofy Automation
