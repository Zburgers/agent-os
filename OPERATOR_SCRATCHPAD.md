# Operator Scratchpad

Last updated: 2026-07-28T21:47:10+05:30

This file is the durable human-readable scratchpad for Goofy. It does not authorize actions by itself; authoritative operational state belongs in PostgreSQL, and long-term contextual facts also belong in Mem0. Use this file to make future sessions resume with the same intent and constraints.

## Owner intent

The owner wants to test whether an autonomous agent can make legitimate money from a small budget and existing compute/resources, similar in spirit to public experiments where models are looped for several days to run a business.

Available starting resources stated by owner:

- fresh VPS / Goofy-owned runtime environment
- Codex subscription treated as fixed infrastructure
- approximately USD 30 operating wallet
- approximately ₹5,000 startup backing context from the mission
- owner can provide human-only actions when necessary

## Current operating interpretation

Goofy should not merely build software forever. The software/control plane exists so Goofy can safely and observably operate revenue experiments with minimal owner involvement.

Before readiness:

- build and verify the Agent OS
- perform zero-cost research only
- prepare drafts, plans, scorecards, and assets internally
- record any needed owner action as an approval item once the approval inbox is ready

After readiness and explicit owner approval:

- research several plausible revenue paths
- choose bounded experiments based on evidence
- spend only within approved limits
- send external communications only under scoped policy
- track every lead, message, cost, artifact, payment, and lesson
- kill weak experiments quickly and rotate to better ones

## Things Goofy may eventually need from the owner

Do not request these all at once. Ask only when immediately useful.

Potential future needs:

- dedicated business/contact email or forwarding address
- Telegram bot token and owner Telegram ID, if not already configured
- explicit policy for where and how Goofy may send low-volume outreach
- payment provider choice and owner-completed KYC/test-mode credentials
- wallet/payment account only through approved provider flow; never raw passwords, OTPs, UPI PINs, or card secrets
- access to domains, DNS, or deployment targets if a product/site needs publishing
- approval for any paid spend, recurring subscription, legal agreement, public reputational claim, or external account creation

## Communication and email resources

- AgentMail email identity is available for Goofy: `goofyboy@agentmail.to`.
- AgentMail docs index: https://docs.agentmail.to/llms.txt
- Complete AgentMail reference: https://docs.agentmail.to/llms-full.txt
- AgentMail implementation notes live at `docs/AGENTMAIL.md`.
- Telegram and Discord are already set up in the broader Goofy/Hermes environment according to the owner; use them only through the Agent OS integration and approval policies when wired.
- AgentMail API key belongs only in runtime secret storage such as `.env` or a proper secret manager, never in Mem0, tracked docs, logs, or dashboard output.
- AgentMail `/v0/auth/me` was verified on 2026-07-28 with HTTP 200; the credential is organization-scoped. The returned IDs are intentionally not recorded here.

## Current known blocker

The Agent OS is not ready for revenue operations. The dashboard/control plane still needs full P0 verification. Latest attempted baseline verification failed during browser workflow cleanup because the disposable PostgreSQL database `goofy_browser_workboard` had an active session during `dropdb`.

The former browser cleanup blocker is fixed. Hermes Agent OS MCP, hook, skill,
and active-provider integration are now live and verified. Current P0 blockers
are the constitution's self-hosted Mem0 deployment requirement (Hermes is
currently configured in platform mode), corrected Telegram/Discord delivery
targets and controlled receipt evidence, complete provider crash-boundary
delivery evidence, private HTTPS, and the routed production command-centre
visual matrix.

## Current next engineering action

Provision the missing owner-managed integration credentials/services, then run live channel, Mem0 scope/restore, and provider crash-boundary tests. Complete the routed frontend before moving every P0 readiness gate to PASS. Do not request or release the tranche meanwhile.

## 2026-07-29 P0 enforcement update

All repository-side gates now pass their current acceptance suites. Durable
jobs, shared pause/kill, database audit backstops, finance metadata and reserve
controls, authentication/session hardening, responsive dashboard routes, domain
CRUD, restart/restore, and scoped Mem0 have reproducible evidence.

Two human boundaries remain and are correctly PARTIAL: the reviewed Hermes
post-tool completion hook needs owner allowlisting, and the configured Telegram
bot needs one incoming owner message before a live owner-chat receipt can be
proved. Do not release capital or lower `commercial_lock` until both are
completed and the matrix is all PASS.

## 2026-07-29 production-hardening evidence

- Migration 008 adds commercial lock, scoped credential metadata, durable denied effects, channel outbox, memory metadata, recurring-job fields, finance reservations/rates, backup evidence, and readiness gates.
- Internal jobs now use the central effect boundary. Supervisor kill/restart produced exactly one completed effect.
- Checksummed backup and isolated restore passed.
- The real zero-cost internal experiment completed with linked objective, venture, experiment, task, job/run, effect, artifact checksum, activity, lesson, and decision.
- Unit, build/check, PostgreSQL integration, browser workflow, npm audit, Compose health, and financial/commercial invariants passed.
- The temporary standalone Agent OS plugin scaffold was removed after confirming Hermes already provides channels, hooks, MCP, skills, and Mem0. Future integration must extend/configure the existing Hermes facilities without duplicate plugin state.

## External side-effect log

- 2026-07-28T23:12:03+05:30: Owner explicitly requested a one-off AgentMail delivery test to `ekagra7865@gmail.com`. Sent from `goofyboy@agentmail.to` via AgentMail. API returned HTTP 200 with message/thread IDs. This does not create a standing outreach policy and does not unlock revenue operations.
