# Shipyard Lessons Learned

## 2026-08-10 Phase: Account observability and governance workspace

### What Went Well
- A metadata-only account registry and a fixed file-backed document registry kept dashboard observability useful without turning PostgreSQL or the UI into a secret vault.
- Focused route and rendered-HTML contract tests caught missing sidebar wiring and documentation gaps before the full suite.

### Surprises / Discoveries
- The runtime uses Node's strip-types execution, which does not support TypeScript parameter properties; explicit field declarations keep services compatible without adding a transpiler.
- Compose source images are ephemeral, so a file-backed editor needs explicit allowlisted host-file mounts for owner edits to survive image refreshes.

### Pitfalls to Avoid
- Do not implement credential discovery by reading protected files; existence and restrictive-permission metadata are sufficient for the observability layer.
- Do not allow a generic path or raw document payload to reach the file writer; fixed keys, size bounds, secret-shaped-content rejection, and optimistic hashes are all required.

### Process Improvements
- Add a focused documentation contract test whenever a new owner-facing route introduces a security or persistence boundary.
- Run `docker compose config` with the owner-managed environment after Compose edits; a worktree without `.env` is not an actionable Compose validation context.

---
