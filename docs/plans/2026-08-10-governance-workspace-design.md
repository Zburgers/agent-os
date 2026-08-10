# Governance Workspace Design

## Goal

Give the owner a private control-plane page for viewing and editing Agent OS's
runtime laws and operating instructions while keeping the source files, runtime
behavior, and audit boundary explicit.

## Safety boundary

This is a governed editor for a fixed document registry, not an arbitrary file
browser. The registry covers the workspace instructions, mission and
constitution, identity and scratchpad, security/financial/approval policies,
deployment/runbook material, active readiness plans, and the Hermes Agent OS
skill. User-supplied paths are never resolved or written.

Document text remains file-backed because those are the instructions the local
runtime reads. Compose mounts only those known files back to the owner workspace
so edits survive image refreshes. PostgreSQL receives only an audit event with
the document key, relative path, SHA-256, byte count, and actor; it does not
become a second instruction store.

The editor rejects private-key blocks, known credential prefixes, and
secret-shaped assignment values. It applies an optimistic SHA-256 check to
prevent overwriting a newer edit, writes to a same-directory temporary file,
renames atomically, and records the save after the new file is readable.

## User experience

The authenticated `Governance` sidebar page shows the document registry grouped
by Runtime law, Operating policy, Active plans, and Runtime integration. The
owner selects a document, sees its path/hash/size/last-updated metadata, edits
the escaped Markdown in a monospace editor, and saves with the existing
session-CSRF mutation flow. A warning makes the no-secrets boundary prominent.

## API

- `GET /api/operator-documents` returns allowlisted metadata.
- `GET /api/operator-documents/:key` returns one safe document and its SHA-256.
- `PUT /api/operator-documents/:key` requires owner authority, the current
  SHA-256, and new content; it returns `409` for a stale version.

All API routes remain behind the existing authentication middleware. Only the
owner/session or owner bearer can save; an agent bearer can observe but cannot
rewrite runtime law.

## Verification

Tests cover registry/path confinement, reading and hashing, atomic save and
metadata-only audit payloads, secret rejection, stale-write rejection, route
contracts, UI wiring, and public operator documentation.
