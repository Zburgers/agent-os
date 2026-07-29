# n8n Read-only Audit — 2026-07-29

Scope: existing self-hosted n8n instance reachable on loopback port 5678.
Credentials and workflow parameter values are intentionally excluded.

## Runtime

- Health endpoint: OK
- Readiness endpoint: OK
- Version: 2.32.6
- Workflows: 6
- Active workflows: 0
- General API keys: 0
- Community nodes: enabled

## Inventory

| Workflow | Nodes | Missing credential bindings | External-capable nodes | Code/host-capable nodes |
|---|---:|---:|---:|---:|
| GA4 Daily KPI Collection | 46 | 8 | 11 | 10 |
| GA4 Daily Data Collection | 11 | 0 | 3 | 2 |
| LinkedIn Job Search (copy 1) | 33 | 3 | 3 | 1 |
| LinkedIn Job Search (copy 2) | 33 | 3 | 3 | 1 |
| Email draft prototype | 3 | 2 | 0 | 0 |
| Email approval/send prototype | 9 | 1 | 1 | 0 |

The structural scanner flagged possible hardcoded secret-bearing parameter
fields in both GA4 workflows. Their values were not printed, copied, or stored
in this report.

Referenced external domains include Google Analytics, Google APIs, Google
Sheets/Drive, Shopify, Discord, Facebook Graph, and LinkedIn.

## Decision

Keep every legacy workflow inactive.

Do not use the LinkedIn workflows for commercial acquisition without a fresh
terms and privacy review. Do not use either email workflow until every send
passes through Agent OS effect authorization and idempotent provider handling.
Do not activate either analytics workflow until suspected embedded secrets are
removed and credentials are moved into n8n's credential store.

Use the official instance-level n8n MCP server rather than a third-party
package. Connect over loopback with a dedicated MCP token stored outside Git,
and expose no legacy workflow initially.

## Revenue value

The instance is useful as:

1. a sandbox for building and testing bounded customer workflow repairs;
2. evidence of practical n8n inspection and reliability work;
3. a future internal revenue-scout and lead-staging engine.

It is not yet a safe unattended distribution engine.
