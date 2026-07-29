# ADR 0004: Mem0 Cloud plus curated local Markdown for initial contextual memory

## Status

Accepted — 2026-07-29.

## Context

The earlier architecture preferred self-hosted Mem0. Initial production readiness needs scoped semantic retrieval, but a self-hosted vector service adds another stateful service, authentication surface, backup/restore burden, and operational failure mode before it has been proven necessary. PostgreSQL already owns business and control state; it must not be displaced by a semantic store.

## Decision

Use three layers with fixed precedence: PostgreSQL operational state, governance documents, curated Markdown, Mem0 Cloud, then model inference. Mem0 Cloud is scoped by owner and scope key and is contextual retrieval only. Curated Markdown is an explicit promotion target for stable, high-value knowledge; it is not a mirror of Mem0. PostgreSQL records provider identifiers and immutable audit evidence for semantic and Markdown mutations, but it does not make contextual records authoritative.

Markdown lives in `memory/`, uses strict frontmatter, atomic serialized mode-0600 writes in mode-0700 directories, and is included in checked backups. A provider outage returns Markdown context and never changes authorization, finance, approval, or effect decisions.

## Consequences

The initial release avoids operating a self-hosted semantic database while retaining a portable durable knowledge layer and a recovery path to any compatible provider. Mem0 Cloud availability and credentials still require reproducible evidence before the existing `scoped_memory` P0 gate can pass. This ADR does not create a separate release gate.
