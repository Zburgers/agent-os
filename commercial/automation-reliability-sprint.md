# Automation Reliability Sprint

**Status:** private launch packet; do not publish or send while the commercial lock
is active.

## Customer-facing offer

### Your automation works—until it doesn’t

I repair one unreliable n8n, API, or AI workflow and leave it with the controls
needed to run without constant babysitting.

In one bounded sprint, you get:

- A reproduced failure and concise root-cause report.
- A repaired workflow or repository patch.
- Retries and timeouts where they are safe.
- Duplicate-execution protection for the critical action.
- Useful error logs and one actionable failure alert.
- A repeatable acceptance test.
- A short handoff document covering normal operation and recovery.

### Pilot — $99

One workflow, up to three integrations, delivered within 48 hours after access and
scope are confirmed.

The pilot includes the repair, one critical-path test, and a written reliability
report. If the problem cannot be reproduced from the supplied materials, the work
stops before implementation and the customer receives the diagnostic notes.

### Standard — $249

One workflow, up to five integrations, with tests, failure handling, structured
logs, one alert route, handoff documentation, and seven days of defect support.

### What this is not

This is not a security audit, penetration test, compliance certification, uptime
guarantee, open-ended feature build, or emergency production incident retainer.
Credentials must be supplied through an approved secret-sharing method and are
removed when the sprint closes.

### Call to action

Send the workflow’s purpose, the failure symptom, a redacted execution log, and the
tools it connects. You will receive a scope decision before any payment or access is
requested.

## Qualification rules

Accept only when all are true:

- The customer controls the workflow and explicitly authorizes access.
- The failure can be reproduced locally, in a customer-provided sandbox, or from a
  redacted workflow export and fixtures.
- The work fits one workflow and the promised integration limit.
- No regulated, medical, high-stakes financial, surveillance, deceptive, abusive,
  or unauthorized use is involved.
- No production write access is needed before an approved, reversible change plan.
- Acceptance can be expressed as observable tests.
- The customer accepts the bounded scope and exclusions.

Decline or rescope when any are true:

- The customer asks for credential harvesting, account takeover, spam, evasion,
  scraping behind authentication without permission, or bypassing platform limits.
- Fixing the workflow requires impersonating a person, accepting third-party terms
  for the customer, or concealing automation.
- The customer cannot establish ownership or authorization.
- The request is really a new product build, 24/7 support, or an undefined
  “optimize everything” engagement.

## Intake schema

1. Business outcome the workflow should produce.
2. Trigger and expected frequency.
3. Connected tools and APIs.
4. Current failure symptom and first observed date.
5. Redacted execution log or screenshot.
6. Workflow export or repository reference.
7. Expected behavior and one representative input/output pair.
8. Whether duplicate execution can cause money movement, messages, deletion, or
   customer-visible side effects.
9. Test or sandbox availability.
10. Data sensitivity and retention requirements.
11. Named person authorized to approve access and the final change.
12. Required deadline and timezone.

## Internal delivery procedure

### 1. Scope

- Record the lead, opportunity, decision, and evidence in the authoritative store.
- Check sanctions, jurisdiction, platform terms, authorization, data sensitivity,
  and prohibited-business rules.
- Convert the requested outcome into explicit acceptance tests.
- List every possible external side effect.
- Reject work that does not fit the qualification rules.

### 2. Reproduce

- Work from a sanitized export or isolated sandbox by default.
- Preserve the original artifact and checksum it.
- Capture the smallest failing input and observed result.
- Do not place customer secrets in logs, source control, prompts, or contextual
  memory.

### 3. Repair

- Patch the smallest responsible surface.
- Add bounded timeouts, explicit retry policy, and terminal failure handling.
- Add idempotency at any non-repeatable side effect.
- Validate inputs and external responses.
- Make partial completion observable.

### 4. Verify

- Run the agreed happy-path test.
- Run timeout, invalid response, duplicate trigger, and dependency failure tests
  where applicable.
- Verify logs identify the failed stage without exposing secrets.
- Prove the critical action does not execute twice.
- Save commands, checksums, and test output as evidence.

### 5. Handoff

- Provide the patch/workflow export.
- Provide the root cause, changes, test results, known limitations, rollback, and
  recovery steps.
- Obtain explicit approval before any production mutation.
- Revoke temporary credentials and record revocation evidence.
- Open the seven-day defect-support window only for the agreed behavior.

## Acceptance checklist

- [ ] Original failure is reproduced or its absence is documented.
- [ ] Happy path passes.
- [ ] Critical side effect is idempotent.
- [ ] Retry behavior is bounded and safe.
- [ ] Timeouts are explicit.
- [ ] Terminal failures are visible.
- [ ] No secrets appear in artifacts or logs.
- [ ] Rollback is documented and tested where practical.
- [ ] Customer can rerun the acceptance test.
- [ ] Temporary access is revoked.
- [ ] Evidence and financial records reconcile.

## Draft channel messages

These are drafts only. They require the production gate and the applicable outbound
authority before use.

### Short marketplace proposal

I can take this as a bounded reliability sprint rather than an open-ended rebuild.
I’ll first reproduce the failing path, then repair one workflow and add the missing
timeouts, safe retries, duplicate-execution protection, and a repeatable acceptance
test. You’ll receive the patch/export plus a short handoff and rollback document.

If you share the workflow’s purpose, integrations, redacted failure log, and one
expected input/output example, I can confirm scope without needing production access.

### Founder/community reply

If the difficult part is not building the automation but keeping it reliable, I
offer a fixed-scope workflow repair: one n8n/API/AI workflow, reproduced failure,
repair, idempotency, failure visibility, and a handoff test. I can assess scope from
a redacted export and log before asking for access.

### Direct message

I noticed you described a workflow that intermittently fails or needs manual
recovery. I run a bounded 48-hour Automation Reliability Sprint: reproduce one
failure, repair it, add safe retries and duplicate protection, and leave a test and
runbook. If useful, send a redacted log and the integrations involved; I’ll respond
with a yes/no scope decision.

## Experiment instrumentation

Track these values without inventing data:

| Stage | Metric |
|---|---|
| Exposure | Qualified people who actually saw the offer |
| Interest | Replies asking a relevant question |
| Qualified lead | Intake satisfies ownership, scope, safety, and budget |
| Proposal | Bounded scope and price delivered |
| Sale | Settled payment, not invoice value |
| Delivery | Hours, compute cost, elapsed time, defects, refund |
| Economics | Realized revenue minus fees, refunds, compute, and direct costs |

Initial decision rules:

- Do not count followers, page availability, bot traffic, or sent messages as
  demand.
- After 20 qualified pitches or 100 qualified page views, pause if there is no
  positive response.
- After three qualified calls but no sale, test offer/pricing before changing the
  acquisition channel.
- After one paid pilot, measure true delivery cost before accepting another at the
  same price.
- Stop immediately if scope creep makes the expected hourly contribution
  unattractive or if customer authorization is unclear.

## Relationship to the Agent Release Gate offer

The Automation Reliability Sprint is the broader entry offer. If the failing
workflow is an agent repository and the buyer needs repeatable evaluation and a
release boundary, rescope it into the existing Agent Release Gate package rather
than selling overlapping work twice.

