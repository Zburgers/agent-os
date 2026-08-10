# Account Observability Design

## Goal

Give the owner one authenticated Agent OS page that shows every external or
runtime account currently observed by the agent, the account's safe identity,
credential presence, source, scope, access status, and last-seen timestamp.

## Safety boundary

This is an observability registry, not a secret vault. PostgreSQL stores only
account metadata and credential metadata. It never stores passwords, API keys,
wallet private keys, recovery material, cookies, OTPs, or credential values.
The API and UI expose only safe metadata such as `available`, `missing`,
`protected runtime`, credential type, and non-secret account identifiers.
Existing protected runtime files are checked for existence and permissions only;
their contents are never crawled or copied into the application.

## Architecture

```text
runtime env names / protected-file metadata / PostgreSQL wallet state
                              |
                    AccountInventoryService
                              |
          owned_accounts + owned_account_credentials
                              |
                 authenticated owner API + UI page
```

Known runtime integrations are reconciled on every Accounts page/API read, so
newly configured credentials become visible without a manual migration. Future
registration workflows can call the authenticated metadata-only registration
endpoint; the endpoint rejects secret-bearing fields and writes an audit event.
Wallet and internal service state are derived from their authoritative tables.

## UI

Add `Accounts` to the shared control-plane sidebar. The page uses the existing
dark operations-console system: a compact summary strip, a searchable table of
platform accounts, protected credential indicators, and a clear explanation
that raw secrets are never displayed. It uses the existing authenticated
session, CSRF, escaping, loading, error, empty, and refresh behaviors.

## Data flow and failure handling

Inventory reconciliation is idempotent by platform and credential metadata
keys. Missing runtime files or partial environment configuration are rendered
as attention states rather than silently omitted. A database failure renders
the existing page error state and never falls back to filesystem secret reads.
All registration and reconciliation mutations are audited with metadata only.
