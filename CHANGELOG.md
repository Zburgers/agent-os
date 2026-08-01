# Changelog

## 2026-08-02 — Persistent NEAR bid monitor

- Added a five-minute durable supervisor job for bid `09d31f07-ca9f-4039-8e78-992b6efe5c29`.
- Each provider check is recorded in job runs and audit activity; a non-pending status transition creates a deduplicated `near_bid_status_alert` event visible in Agent OS.
- Mounted the existing protected NEAR credential as a read-only Compose secret, copied it to an ephemeral mode-0400 agent-owned runtime path before dropping privileges, and ensured the monitor returns and persists no credential material.

## 2026-08-02

- Added a dedicated `/decisions` owner dashboard page that exposes the durable PostgreSQL decision journal with selected options, evidence, expected results, outcomes, lessons, confidence, and review dates.
- Added the Decisions route to primary dashboard navigation, authenticated page routing, and regression coverage so material business decisions are no longer hidden behind the raw API or Telegram command.
- Fixed Compose database authentication after container recreation by removing password interpolation from `DATABASE_URL` and passing Postgres credentials through structured `PG*` environment variables.
- Aligned the existing Postgres role password with the protected Compose runtime secret without deleting or mutating business data.
- Mounted the protected approval-token signing secret into the app container and copied it to a strict agent-owned runtime path before startup, matching the existing protected wallet-key pattern.
- Placed Goofy's first live NEAR Agent Market worker bid on a 4 NEAR technical-writing job and prepared the full draft deliverable for immediate submission if awarded.

## 2026-08-01

- Added an owner-authorized dedicated Goofy wallet with protected mode-0600 key storage, separate from the owner's MetaMask and payment credentials.
- Added default-deny autonomous BountyBook message signing with provider/message allowlists, pause/kill enforcement, derived-address verification, durable rate limits, denial records, and raw-signature exclusion from PostgreSQL/logs/dashboard.
- Added PostgreSQL wallet policy and operation history, Base ETH/USDC balance reporting, authenticated provisioning/signing APIs, wallet and finance dashboard visibility, restart-safe secret mounting, and an idempotent provisioning workflow.
- Added a dated constitutional amendment and updated memory, security, approval, design, implementation, and operator documentation for the autonomous-wallet boundary.
- Updated and validated the `os` skill so future Codex sessions distinguish the owner-linked MetaMask from the bounded dedicated wallet and use the protected BountyBook signer correctly.
- Fixed production key delivery so the host mode-0600 wallet remains read-only while the non-root app receives only a mode-0400 ephemeral runtime copy.
- Provisioned and verified the dedicated wallet in production, including Base ETH/USDC balance visibility and autonomously signed BountyBook authentication.
- Retried the live `$6` Go bounty with a locally tested deliverable; BountyBook accepted claim/submission requests but its public verifier misparsed all documented inline code shapes, reopened the job, and paid nothing.
- Fixed the TypeScript build syntax check so parser failures now propagate instead of being masked by `find`.
- Fixed wallet linking so the `/wallet` page prefers the native MetaMask browser extension provider before falling back to MetaMask Connect SDK.
- Added visible wallet-link progress states for connect, account request, and signature request steps.
- Added regression coverage for direct injected providers, provider arrays, MetaMask `isMetaMask`, provider metadata, fallback provider selection, missing providers, mainnet/no-switch, switch-to-mainnet, and missing-account failures.
- Fixed pre-auth serving for the exact wallet JavaScript assets so browser module loading cannot receive JSON authentication errors.
