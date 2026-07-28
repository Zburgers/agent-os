# Agent Release Gate Setup — Initial Market Study

**Status:** research only; no outreach, public posting, account creation, spending, or payment collection is authorized.

## Recommendation

Prioritize a fixed-scope service for small AI and developer teams that have an agent prototype but lack repeatable acceptance tests and a release boundary.

> Turn an agent prototype into a repository with repeatable acceptance tests, clear release checks, and an auditable approval boundary within three business days.

The proposed launch package is USD 149 and the standard package is USD 349. These are hypotheses to validate, not published prices or revenue forecasts.

## Buyer, deliverable, and exclusions

| Area | Definition |
| --- | --- |
| Buyer | Engineering lead or founder at a small team operating an AI agent or agentic workflow. |
| Deliverable | Repo-local evaluation harness; 20–40 acceptance cases; release checklist; failure triage template; documented human approval boundary; final implementation report. |
| Intake | Buyer supplies a sanitized repository or explicitly grants read-only access. |
| Delivery | Verified payment, then private patch and report. |
| Exclusions | No security certification, penetration test, reliability guarantee, hosting, credential extraction, or unsanctioned access. |
| Acceptance | Tests execute locally; agreed release checks are documented; buyer can reproduce the result. |

## Evidence and market signals

- Anthropic describes meaningful agent evaluations as requiring real or sandboxed tool execution and outcome checks: <https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents>
- OpenAI's Agents SDK treats tracing and guardrails as core operational primitives: <https://openai.github.io/openai-agents-python/>
- Braintrust lists a USD 249/month Pro tier for evaluation and tracing infrastructure: <https://www.braintrust.dev/pricing>
- OpenAI advises review of agent changes and deployments: <https://openai.com/index/introducing-upgrades-to-codex/>

These sources support the existence of a control/evaluation problem and paid alternatives. They do not prove demand for this offer, price, or conversion rate.

## Competition and differentiation

Platforms such as Braintrust and LangSmith, plus independent consultants, compete in the broader evaluation category. The intended differentiation is a bounded implementation outcome: working repository tests and a release gate in a short, fixed engagement, not generic strategy or a replacement SaaS platform.

## Zero-cost validation plan

1. Build a self-contained demo repository with a deliberately flawed support agent, test dataset, evaluation command, release checklist, and before/after report.
2. Prepare an intake form, scope page, and one draft technical/community post. Keep all material private pending owner approval.
3. Request one narrow approval before any publication or direct outreach.
4. For 30 days after approved publication, success is three qualified inbound intake submissions or one paid pilot. Stop if 100 relevant page visits produce no qualified interest.

## Safety and approval gates

- No external messages, public posts, payment accounts, contracts, or customer access before the Agent OS readiness gate and the relevant owner approval.
- Use customer-supplied authorization and minimize data. Do not put private code or documentation into third-party models without explicit permission.
- Do not make compliance, certification, security, reliability, or ROI claims.
- Owner must handle KYC, bank/payment linkage, legal declarations, and binding terms when payment collection becomes necessary.

## Other ranked candidates

1. MCP security and permission review (authorized source/config review only).
2. Agent-ready documentation / Docs-to-MCP sprint.
3. Coding-agent guardrails pack for existing repositories.
4. Public-source competitive-change brief for agent/devtool startups.

Reference research: MCP security guidance (<https://modelcontextprotocol.io/docs/tutorials/security/security_best_practices>), OWASP MCP Top 10 (<https://owasp.org/www-project-mcp-top-10/>), Mintlify pricing (<https://www.mintlify.com/pricing>), and GitHub Copilot organization pricing (<https://docs.github.com/en/copilot/concepts/billing/organizations-and-enterprises>).
