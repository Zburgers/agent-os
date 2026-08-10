# Governance Workspace Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use shipyard:shipyard-executing-plans to implement this plan task-by-task.

**Goal:** Add an authenticated, editable, allowlisted workspace for Agent OS runtime laws and operating instructions.

**Architecture:** Keep the document corpus file-backed, expose fixed-key reads and owner-only writes through a service/API, mount only those exact files in Compose, and audit saves by hash/size without storing document text in PostgreSQL.

**Tech Stack:** TypeScript, Node.js HTTP server, PostgreSQL audit events, Docker Compose, server-rendered HTML with the existing inline client, Node test runner.

---

### Task 1: Document registry and safe atomic service

**Files:**
- Create: `src/operator-documents.ts`
- Test: `test/operator-documents.test.ts`

Implement the fixed registry, path confinement, safe-content validation, SHA-256 optimistic concurrency, atomic same-directory replacement, and metadata-only audit payload. Verify with `node --test --experimental-strip-types test/operator-documents.test.ts`.

### Task 2: Authenticated API and persistent Compose mounts

**Files:**
- Modify: `src/server.ts`
- Modify: `compose.yaml`
- Test: `test/operator-documents.test.ts`

Add authenticated list/read routes and owner-authority-only `PUT` saves, use the larger bounded body limit only for document writes, map document errors to safe HTTP statuses, and mount the exact allowlisted files read-write so edits persist across image rebuilds. Verify route contracts and `docker compose config`.

### Task 3: Governance control-plane page

**Files:**
- Modify: `src/control-plane.ts`
- Test: `test/workboard.test.ts`

Add the sidebar route, document picker, metadata display, editor, optimistic save flow, visible warning, responsive styling, and error handling. Verify server-rendered route/UI contracts and the full test suite.

### Task 4: Operator documentation and release gates

**Files:**
- Create: `docs/plans/2026-08-10-governance-workspace-design.md`
- Modify: `README.md`
- Modify: `ARCHITECTURE.md`
- Modify: `RUNBOOK.md`

Document the allowlist, persistence, audit boundary, and secret rule. Run `npm test`, `npm run check`, `npm audit --omit=dev`, `git diff --check`, and the security/simplification review before merging.
