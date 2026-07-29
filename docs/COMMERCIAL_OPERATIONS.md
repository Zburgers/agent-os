# Commercial Operations

The `/commercial` workspace is the authoritative, lightweight revenue
operations view for Goofy Agent OS. It is deliberately smaller than a general
CRM: every feature exists to answer one of four questions.

1. Who might buy, and how well are they qualified?
2. What offer is being sold, at what price?
3. What happened after an approved message was sent?
4. What is the next action most likely to advance or close the opportunity?

PostgreSQL is authoritative. The dashboard does not infer contacts, replies,
buyers, or revenue from Markdown files, Mem0, or model output.

## Curated model

- `leads` holds both unqualified potential buyers and qualified prospects.
  `pipeline_stage` makes the distinction explicit. A scraped or merely
  discovered record stays `potential`; it is not counted as a qualified sales
  opportunity.
- `customers` is separate from leads. A won prospect is not automatically
  treated as settled revenue. Customer revenue is derived from verified,
  settled payment records.
- `commercial_products` stores offers, target buyers, delivery summaries, and
  one-time, recurring, usage, custom, or free pricing.
- `commercial_messages` records a minimal redacted preview and immutable
  linkage. Every outbound row requires the approval and completed or
  reconciliation-required message effect that authorized the actual send.
- `commercial_message_events` is an append-only delivery timeline. Provider
  event IDs are unique, so webhook retries cannot duplicate delivery or reply
  events.
- `commercial_activities` stores research, follow-up, proposal, delivery, and
  renewal work. Completing a recurring activity creates exactly one next
  occurrence; the historical activity is retained.

The dashboard prioritizes overdue activities, near-term actions, and qualified
prospects. Pipeline value is displayed as unweighted potential value and is
never labelled as revenue or profit.

## External-action and privacy boundaries

This module records commercial state; it does not send messages or weaken any
effect policy. Sending still requires:

1. a live, correctly scoped approval;
2. an authorized `message` effect intent;
3. a successful one-time guard claim;
4. provider execution with idempotency;
5. a recorded effect result.

Only after step 5 may an outbound message be recorded here. An ambiguous
provider boundary is retained as `reconciliation_required`, not silently
retried.

Contact endpoints remain available to authorized server-side automation but are
masked in list and detail API responses. Message bodies are not stored here.
Only a maximum 500-character preview is retained, after runtime secret
redaction. Provider event evidence must not contain message bodies, credentials,
cookies, OTPs, or payment data.

## API

All endpoints require existing Agent OS authentication. Mutations use the same
owner-session CSRF protection or agent bearer authentication as the rest of the
control plane. Versioned mutations also require `Idempotency-Key`.

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `GET` | `/api/v1/commercial/overview` | Funnel, outreach, buyer, activity, product, and pipeline metrics |
| `GET/POST` | `/api/v1/commercial/prospects` | List or create potential buyers and prospects |
| `GET/PATCH` | `/api/v1/commercial/prospects/:id` | Inspect timeline or update a prospect |
| `GET/POST` | `/api/v1/commercial/products` | List or create products and offers |
| `GET` | `/api/v1/commercial/customers` | Qualified actual-buyer/customer view |
| `GET/POST` | `/api/v1/commercial/activities` | List or schedule follow-ups and recurring work |
| `PATCH` | `/api/v1/commercial/activities/:id` | Complete or cancel an activity |
| `GET/POST` | `/api/v1/commercial/messages` | List or record authorized message outcomes |
| `POST` | `/api/v1/commercial/messages/:id/events` | Append a deduplicated delivery or reply event |

## Research basis

Feature selection was reviewed on 2026-07-29 against current primary product
documentation:

- Pipedrive separates unqualified leads from active deals and carries notes,
  activities, and communication forward when a lead is qualified:
  <https://support.pipedrive.com/en/article/leads-inbox>
- Pipedrive orders pipeline work by the next activity so overdue and due-today
  opportunities receive attention first:
  <https://support.pipedrive.com/en/article/how-are-deals-ordered-in-the-pipeline-view>
- Pipedrive links deal records to contacts, products, activities, email, and
  recurring revenue:
  <https://support.pipedrive.com/en/article/deals-what-they-are-and-how-to-add-them>
- Pipedrive sequences combine personalized email with follow-up activities:
  <https://support.pipedrive.com/en/article/sequences>
- Resend documents distinct sent, delivered, delayed, bounced, failed,
  complained, opened, clicked, and received events:
  <https://resend.com/docs/webhooks/event-types>
- Resend recommends signature verification and unique event IDs for idempotent
  webhook storage:
  <https://resend.com/docs/webhooks/ingester>

The implementation omits bulk-email tooling, automated cadence sending,
tracking pixels, arbitrary custom fields, and decorative forecasts. Those
features add privacy, spam, or complexity risk without improving the current
high-touch, low-volume path to first revenue.

