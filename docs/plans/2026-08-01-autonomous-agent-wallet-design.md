# Autonomous Goofy Wallet Design

## Decision

The owner explicitly authorizes Goofy to control a dedicated operational wallet. This authority applies only to a new agent wallet and does not grant access to the owner's MetaMask wallet, bank credentials, recovery material, or unrelated payment accounts.

## Architecture

The private key lives outside PostgreSQL, source control, logs, Mem0, backups, and dashboard responses in a mode-0600 runtime secret file owned by the `goofy` Linux account. PostgreSQL stores only the wallet's public address, policy, operation metadata, message hashes, provider, outcome, timestamps, and external references. The dashboard exposes these public records and balances while never returning signatures or key material.

The first production capability is bounded EIP-191 message signing for BountyBook authentication. The signer accepts only the `bounty:<32 lowercase hex>:<10 digit timestamp>` format, requires provider `bountybook`, checks pause/kill state, rate-limits operations durably, and records both successful and denied attempts. It does not sign arbitrary messages, typed data, transactions, permits, approvals, or contract calldata.

Future transaction signing remains behind the existing effect, ledger, reserve, and spending controls. Autonomous signing does not imply autonomous spending authority. Chain allowlists, per-action and daily limits, simulation, idempotency, and reconciliation must be implemented before transaction signing is enabled.

## Lifecycle and recovery

Provisioning is idempotent and owner-attributed. Rotation revokes the old public wallet record and creates a new protected key file. The kill switch immediately blocks signing. Restart recovery loads the protected key only when signing and verifies that its derived address matches PostgreSQL. A mismatch fails closed and creates no signature.

## Threat model

The primary risks are key theft from the VPS, prompt-driven signing abuse, secret leakage through logs/API responses, and uncontrolled spending. Controls are Linux file permissions, strict message/provider allowlists, no signature persistence, authenticated agent-only signing APIs, durable rate limits, public audit records, kill/pause enforcement, no transaction-signing capability in this phase, and separate owner/agent wallets.

## Success criteria

- A dedicated wallet can be provisioned without exposing its key.
- BountyBook nonces can be signed autonomously and verified remotely.
- Every signing attempt appears in PostgreSQL and the wallet dashboard.
- Pause/kill, malformed messages, unsupported providers, address mismatch, and excessive signing fail closed.
- Tests, build, dependency audit, migration, health check, and browser/dashboard verification pass before bounty use.
