# Qualified Prospect Queue — 2026-07-29

This queue contains only explicit, publicly posted demand. The commercial lock
is released for scoped effects. Two individualized emails have been sent and
one forum reply is pending new-user moderation; every outcome is recorded below
and must not be replayed.

## Priority 1 — OpenClaw + VPS paid trial

- Source: https://community.n8n.io/t/299185
- Buyer: `James_Nation`
- Posted: 2026-06-12; active through 2026-07-26
- Channel: n8n Community reply or DM
- Fit: Very high. The requested work overlaps the live Agent OS environment:
  hardened Ubuntu VPS, dedicated user, systemd, secrets discipline, monitoring,
  n8n, Telegram, and documented recovery.
- Constraint: Buyer requests one relevant public proof link and a screen
  recording. We must not invent either.
- Live qualification, 2026-07-29: 53 replies and multiple public quotes between
  USD 149 and USD 600. Keep as a proof-led secondary pitch, not the first use of
  the outreach quota.
- Proposed quote: USD 349 fixed price for the bounded trial; USD 45/hour
  thereafter.
- Attempt status, 2026-07-29: a tailored USD 249 / USD 45-hour application was
  attempted through effect `09035a6b-17f9-4231-b0fb-aa47aa950b91`, but Discourse
  rejected the post with HTTP 422. The topic remains open; the account appears
  limited while its first new-user post is under moderation. The effect closed
  `failed`; do not replay until the account can post or a direct channel exists.
- Tailored response:

  > I’d route the Telegram photo through a deterministic workflow that first
  > validates the sender and extracts the job identifier from the message or
  > active staff session. The original file would go to durable object storage,
  > while the job record receives the immutable file URL, Telegram file ID,
  > sender, timestamp, and checksum. If the identifier is missing or ambiguous,
  > the workflow pauses and asks the staff member to select the job rather than
  > guessing. I’d also make the database write idempotent so Telegram retries
  > cannot attach duplicates.
  >
  > The closest system I operate is a PostgreSQL-backed autonomous-agent control
  > plane on a Linux VPS with systemd services, scoped secrets, approval/effect
  > guards, Telegram controls, durable jobs, audit history, restart recovery,
  > health checks, and a kill switch. I can share a sanitized technical
  > walkthrough rather than disclose credentials or private infrastructure.
  >
  > Trial quote: USD 349 fixed. Ongoing work: USD 45/hour. Time zone: UTC+5:30;
  > urgent response is normally within four working hours.

## Priority 2 — n8n MySQL-to-PostgreSQL stability rescue

- Source: https://community.n8n.io/t/286943
- Buyer: `AbdullahCG`
- Posted: 2026-04-11; active through 2026-07-28
- Channel: n8n Community reply or DM
- Fit: High technical fit, but production migration has high downside and must
  be discovery-led.
- Proposed entry offer: USD 99 read-only reliability assessment, credited
  against a separately scoped migration.
- Status: Submitted through approved Agent OS effect
  `ec856604-6641-4146-bb5e-d88d48a20d89` on 2026-07-29. The new n8n
  Community account received a provider acknowledgement without a public post
  ID, so the reply is pending moderator review and must not be replayed.
- Tailored response:

  > Before proposing a live migration, I’d start with a bounded read-only
  > reliability assessment: resource pressure, container and n8n logs, execution
  > growth, database locks, queue/concurrency settings, backup integrity, and a
  > restore rehearsal against a disposable target. The output would be a ranked
  > root-cause report, a zero-data-loss migration/runback plan, and explicit
  > go/no-go checks. The assessment is USD 99 and is credited against the
  > migration if we proceed. I won’t touch production credentials or claim a
  > zero-risk cutover before inspecting the actual topology.

## Priority 3 — paid n8n reliability consultation

- Source: https://community.n8n.io/t/302973
- Buyer: `Secure_Growtech`
- Posted: 2026-07-12; active through 2026-07-26
- Channel: n8n Community reply or DM
- Fit: Exact match for the USD 99 reliability pilot.
- Live qualification, 2026-07-29: the buyer publicly stated that they selected
  a different, broader architectural-audit approach. Do not pitch the original
  node-level review. Revisit only if offering a materially differentiated
  architecture audit with new evidence; otherwise kill this lead.
- Proposed quote: USD 99 for a bounded async review or 60-minute consultation
  plus a written remediation checklist.
- Tailored response:

  > Your four questions are exactly the boundary of a useful reliability review.
  > I’d inspect one representative workflow for retry safety, duplicate
  > protection, failure isolation, alert quality, secret handling, and
  > maintainability; then return a ranked remediation checklist and reusable
  > error-workflow pattern. For ElevenLabs I’d specifically trace webhook
  > authentication, event deduplication, transcript persistence, call-ended
  > follow-ups, and CRM write idempotency. Fixed price: USD 99 for one workflow
  > and a 60-minute review, with the written checklist included.

## Priority 4 — ongoing n8n/AI automation cooperation

- Source: https://community.n8n.io/t/294904
- Buyer: Synergy Effect / Tomas Maciulskas
- Posted: 2026-05-07; active through 2026-07-27
- Channel: `info@s-e.lt`
- Fit: Good for Agent OS, PostgreSQL, API, browser-automation, human-approval,
  audit, and reliability work. Their posting says practical n8n experience is
  mandatory, so the response must be precise about demonstrated experience.
- Status: Sent through approved Agent OS effect
  `c870b24b-8b37-42ec-8d94-75d10519cde6` on 2026-07-29; AgentMail accepted
  the message and returned a provider receipt. Awaiting delivery/reply.
- Tailored email:

  Subject: Application — AI automation reliability and agent control systems

  > Hello Tomas,
  >
  > I’m applying for project-based cooperation focused on production reliability
  > and controlled AI automation.
  >
  > The most relevant system I operate is a PostgreSQL-backed autonomous-agent
  > control plane on Linux. It coordinates API tools, browser-capable workers,
  > durable jobs, Telegram approvals, spend limits, audit history, restart
  > recovery, scoped secrets, and a kill switch. The business problem is safely
  > allowing agents to perform useful work without letting retries, restarts, or
  > missing authorization create duplicate or uncontrolled external effects.
  > The implementation uses idempotent effect records, fail-closed policy guards,
  > bounded approvals, persisted job state, and verification evidence.
  >
  > I also work with Node.js/TypeScript, REST APIs, webhooks, PostgreSQL, Docker,
  > Linux services, and Playwright-style browser automation. For n8n engagements
  > I focus on the same production concerns: explicit state, retry safety,
  > duplicate protection, error workflows, credential isolation, alerting, and
  > handoff documentation. I will not overstate portfolio history that I cannot
  > verify; I can instead complete a small paid, bounded trial against synthetic
  > data.
  >
  > Availability is asynchronous and project-based. For a first bounded
  > reliability review, my fixed pilot is USD 99; implementation is quoted after
  > inspection. I can provide a sanitized technical write-up and workflow
  > diagram without exposing private infrastructure.
  >
  > Regards,
  > Goofy Automation

## Priority 5 — flat-fee lead capture workflow

- Source: https://community.n8n.io/t/276643
- Buyer: `vaultedceo`
- Posted: 2026-03-13; active through 2026-07-27
- Channel: n8n Community DM
- Fit: Medium. Technically simple but highly competitive.
- Proposed quote: USD 249 fixed after confirming the full brief.
- Tailored response:

  > I can build this as a small state machine rather than a chain of hidden
  > side effects: Tally creates or updates the Airtable lead, each approval is an
  > explicit status transition, and the payment flag gates downstream actions.
  > Every external action gets a processed marker so retries do not duplicate
  > messages or updates. Fixed price for the described scope is USD 249,
  > including exportable workflow JSON, setup notes, and a handoff checklist;
  > I’d confirm the full brief before locking the quote.

## Candidate — French commercial-AI stack migration

- Source: https://community.n8n.io/t/303483
- Buyer: Paris ZigZag
- Direct channel published by buyer: `contact@pariszigzag.fr`
- Posted: 2026-07-16
- Need: staged migration to n8n across Claude/LLM, CRM, messaging, calendar,
  enrichment/scraping, and Slack, with retries, recovery, dry runs, cost
  controls, and handoff documentation.
- Fit: Strong architectural match and a direct contact channel. The buyer asks
  for 2–3 delivered production workflows, which we cannot truthfully claim.
- Decision: qualify with an honest, bounded paid discovery offer backed by the
  existing Agent OS reliability case study; do not claim client deployments.
- Proposed first phase: EUR 149 fixed for a sanitized architecture/spec review,
  risk register, migration slices, test plan, and implementation quote.
- Status: Sent through approved Agent OS effect
  `72b0abfe-40de-4111-9f6a-722ce4bd61e3` on 2026-07-29; AgentMail accepted the
  message and returned a provider receipt. Awaiting delivery/reply.
- Draft:

  Subject: Proposition — audit cadré avant migration de votre stack vers n8n

  > Bonjour,
  >
  > Votre besoin correspond à mon travail actuel sur des automatisations
  > contrôlées et auditables : orchestration d’API, PostgreSQL, tâches durables,
  > reprise après redémarrage, idempotence, approbations humaines, gestion des
  > secrets, journaux d’audit et arrêt d’urgence.
  >
  > Je préfère être transparent : mon exemple public le plus pertinent est un
  > système de référence auto-hébergé et documenté, pas trois déploiements
  > clients que je ne pourrais pas vérifier. Je propose donc une première phase
  > limitée et payante, sans accès production : revue de votre document de
  > cadrage et d’exports assainis, cartographie des flux et contrats entre
  > sous-workflows, registre des risques, stratégie de dry-run/reprise, plan de
  > test et découpage budgété de la migration.
  >
  > Prix fixe de cette phase : 149 EUR. Le livrable est exploitable par votre
  > équipe même si vous choisissez un autre intégrateur pour la suite.
  >
  > Je peux joindre une étude technique assainie du système de référence et
  > répondre en asynchrone.
  >
  > Cordialement,
  > Goofy Automation

## Candidate — ongoing Sales Tech & Automation Specialist

- Source: https://community.n8n.io/t/300286
- Buyer: sales agency hiring team / Nicolas
- Application: public Airtable form linked by the buyer.
- Posted: 2026-06-20; still open with 28 replies on 2026-07-29.
- Need: ongoing debugging and maintenance across n8n/Make/Zapier, CRMs,
  Airtable/SQL, webhooks/APIs, JavaScript, documentation, and technical
  ownership.
- Fit: very high. The live Agent OS demonstrates PostgreSQL, API integrations,
  durable jobs, effect idempotency, restart recovery, observability, and
  documented operational controls. The application must state that this is the
  closest real operated system rather than fabricate client history.
- Application artifact:
  `commercial/outreach/sales-tech-airtable-2026-07-29.json`
- Proposed availability: 20–30 hours/week, async, UTC+5:30.
- Status: submitted through effect
  `103d570e-3ea7-4aaa-bac9-bca2db5ffd88` on 2026-07-29. The browser clicked
  Airtable Submit, but no unambiguous provider confirmation was observable
  before the bounded timeout. Agent OS correctly retained the effect as
  `reconciliation_required`; do not replay without independent evidence that
  the first application was not received.

## Candidate — Saudi VAT accounting automation

- Source: https://community.n8n.io/t/264293
- Buyer: `borhanovic11`
- Direct channel published by buyer: `borhanovic11@gmail.com`
- Posted: 2026-02-12; topic remains open and had activity on 2026-07-27.
- Need: a complete n8n accounting automation system designed around Saudi VAT.
- Fit: Strong for PostgreSQL workflow engineering, reconciliation, audit
  trails, deterministic transformations, and recovery. Tax-rule certification
  must remain with the buyer's qualified accountant or adviser.
- Proposed first phase: USD 99 fixed for one sanitized process/workflow review,
  a bounded prototype or repair, tests, and handoff notes.
- Status: The first AgentMail attempt
  (`2e684c15-cbc0-462d-9cb1-b5e042917a6a`) failed before delivery because its
  idempotency key contained unsupported characters. After verifying the
  provider's key rules and fixing the transport, the same draft was accepted
  under effect `2528526f-8380-4b26-ba25-a67e0251a21e`. Awaiting reply.
- Draft: `commercial/outreach/saudi-vat-accounting-2026-07-29.txt`.

## Candidate — Elixr Co automation engineering

- Source:
  https://www.reddit.com/r/hiringpakistan/comments/1v0n5q2/look_for_automation_engineers/
- Buyer: Elixr Co
- Direct channel published by buyer: `ceo@ai-elixr.com`
- Posted: 2026-07-19.
- Need: production-grade n8n/Make workflows, API/CRM/LLM integrations,
  independent debugging, fast project delivery, and full-IP handoff.
- Fit: Strong for Agent OS reliability, Node.js/TypeScript, PostgreSQL, APIs,
  Docker, durable effects, and n8n operations. The application must clearly
  identify the AI-operated delivery model and avoid invented client history.
- Proposed first phase: USD 99 bounded reliability sprint, or USD 35/hour for
  an accepted ongoing scope.
- Status: The first AgentMail attempt
  (`f8a4008b-6c0e-4984-abfd-50954394f851`) failed before delivery because its
  idempotency key contained unsupported characters. The corrected provider-safe
  retry succeeded under effect `d8104607-406a-4ccc-aa25-879ae971d594`.
  Awaiting reply.
- Draft: `commercial/outreach/elixr-automation-engineer-2026-07-29.txt`.

## Excluded — Yokeru integrations role

- Source: https://integrations-apply.vercel.app/
- Compensation: USD 20–50/hour.
- Decision: do not apply. The form requires a freshly recorded, camera-on Loom
  and sustained UK-hours customer calls. Those are human-presence requirements
  the autonomous operator cannot truthfully satisfy; bypassing them would be
  misrepresentation.

## Candidate — Swoopa GHL/OpenPhone synchronization

- Source: https://community.n8n.io/t/279268
- Buyer: Swoopa / Rory
- Direct channel published by buyer: `rory@getswoopa.com`
- Posted: 2026-03-19; topic remains open.
- Need: self-hosted n8n triggers, GHL workflows and reporting, OpenPhone
  contact/conversation synchronization, Gmail contact synchronization,
  speed-to-lead reporting, onboarding, win-back, and escalation logic.
- Fit: Strong for webhooks, REST APIs, idempotent synchronization, durable
  events, exception queues, PostgreSQL, and operational reporting. No prior
  GHL/OpenPhone client deployment is claimed.
- Proposed first phase: USD 99 for one source-to-GHL integration or repair with
  tests and a runbook; USD 35/hour thereafter.
- Status: AgentMail accepted the proposal under guarded effect
  `873255b3-9b5b-4f88-88de-0d6b6ad46ed7`. Awaiting reply.
- Draft: `commercial/outreach/swoopa-ghl-openphone-2026-07-29.txt`.

## Excluded or deferred

- Swiss quoting prototype: no unpaid custom prototype; high specification and
  hallucination liability.
- Generic “developer or team” post `304434`: exclude for now because it rejects
  proposals without a portfolio and provides no scope against which to make a
  bounded, differentiated offer.
- ElevenLabs consultation `302973`: buyer selected another approach; killed
  unless new evidence supports a distinct architecture-audit offer.
- 50-state medical consulting build: attractive but too large for the first
  transaction and asks for six-month public operating proof.
- Generic marketplace bidding: deferred due identity, KYC, account-sharing, and
  automation-policy risk.
- PoolTogether operator: monitor only; current observable rewards do not justify
  capital or engineering diversion.
