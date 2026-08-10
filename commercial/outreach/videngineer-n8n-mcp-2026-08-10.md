# Videngineer n8n/MCP workflow outreach — 2026-08-10

**Status:** prepared for one guarded email send under approval
`e1da14e2-8862-4695-84d0-5daf0ddfcfc3`.

**Buyer source:** [current public hiring request](https://www.reddit.com/r/n8n/comments/1vf1qz2/looking_for_an_n8n_specialist_to_make_workflows/), accessed 2026-08-10.
The post asks for production n8n workflows connecting an external MCP service,
processing structured video-analysis data, emailing a concise report, and
testing OAuth, validation, and error paths. It states a paid project and a
budget ceiling of up to $500/month.

**Published contact route:** `mark@videngineer.com`, decoded from the public
Cloudflare-protected Contact link on [videngineer.com](https://videngineer.com/).

## Proposed email

Subject: A bounded first workflow for Videngineer’s n8n + MCP integration

Hi Mark,

I’m Goofy, the AI CEO/operator of Neuratech. I saw your request for help
building production-ready n8n workflows for Videngineer, especially the first
MCP-to-n8n flow that turns structured video-analysis data into a concise email
report.

My fit is the reliability layer around that workflow: HTTP/MCP integration,
credential-safe OAuth boundaries, schema validation, branching, retries,
idempotency, and an auditable handoff. I run a PostgreSQL-backed Agent OS that
uses those same approval, effect, and recovery controls; I can share the
sanitized repository as evidence without claiming a fictional client résumé:
https://github.com/Zburgers/agent-os

I suggest a small fixed first milestone rather than an open-ended engagement:
one importable n8n workflow that accepts a defined MCP response fixture,
validates the payload, renders the email report, covers success/auth/timeout
and malformed-data cases, and includes a short runbook. A reasonable starting
fee is USD 149, with any follow-on Slack/Notion/Sheets workflows scoped
separately. I can work asynchronously and identify myself as an AI-operated
studio; I will not request production credentials for the initial fixture-led
milestone.

If that evaluation format is useful, send the first payload shape and the
acceptance criteria. If you need a human-only employee or live client calls,
I’m not the right fit. If you prefer no further contact, reply “stop” and I
will record the suppression.

— Goofy\nAI CEO/operator, Neuratech

## Guarded-send evidence

- Approval: `e1da14e2-8862-4695-84d0-5daf0ddfcfc3` (approved; zero-cost,
  maximum ten current explicit-buyer contacts; one follow-up maximum).
- Contact was independently verified from the current public request and the
  company’s current public site; no private data or scraped directory was used.
- The send must be effect-authorized and idempotent. Do not send a follow-up
  unless a reply or fresh engagement justifies it, and do not accept a contract
  or request production credentials under this scope.
