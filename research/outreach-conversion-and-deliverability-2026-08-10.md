# Outreach conversion and deliverability research — 2026-08-10

Status: research complete; implementation is gated on sender/legal readiness.
No new message was sent during this research pass.

## What the evidence says

### Legal and consent boundaries

- The US FTC says CAN-SPAM applies to commercial email, including B2B email,
  and requires truthful headers/subjects, sender identification, a valid postal
  address, a clear opt-out, and prompt honoring of opt-outs. Source:
  <https://www.ftc.gov/business-guidance/resources/can-spam-act-compliance-guide-business>
- UK ICO guidance distinguishes corporate subscribers from sole traders and
  partnerships. Corporate business email can be treated differently under
  PECR, but personal data still triggers UK GDPR; ambiguous contacts should be
  treated conservatively. Source:
  <https://ico.org.uk/for-organisations/direct-marketing-and-privacy-and-electronic-communications/business-to-business-marketing/>
- Therefore the pilot must use existing qualified corporate contacts only,
  avoid personal/sole-trader addresses unless a lawful basis is recorded, and
  maintain a durable do-not-contact list.

### Deliverability

- Google requires authentication and TLS for Gmail traffic and recommends
  keeping user-reported spam below 0.1% (never reaching 0.3%); it also recommends
  gradual, consistent volume and easy unsubscribe. Source:
  <https://support.google.com/mail/answer/81126>
- AgentMail's send API accepts custom headers, so a production marketing
  message can carry `List-Unsubscribe` and `List-Unsubscribe-Post` when the
  unsubscribe endpoint is implemented. Source:
  <https://docs.agentmail.to/api-reference/inboxes/messages/send>
- Our current inbox is an agentmail.to address rather than an owned NeuraTech
  domain, so sender identity and authentication must be verified before scaling.
  A ten-message pilot is the maximum until delivery/bounce/complaint signals
  are observed.

### Customer hook

- Gong's analysis of 85 million cold emails reports that activity/business-
  problem personalization outperforms personal trivia, prospect-focused
  problem/value language beats seller jargon, and an offer or interest check
  beats asking directly for a meeting. Source:
  <https://www.gong.io/files/gong-guide-how-to-master-cold-email-get-the-data-backed-guide-based-on-85-million-emails.pdf>
- Applied to NeuraTech: lead with a concrete trigger observed in the prospect's
  automation, name one failure mode, offer a fixed-scope $250 reliability
  sprint with a tangible deliverable, and ask whether the problem is live. Do
  not lead with "AI", broad capabilities, invented proof, or a calendar link.

## Safe message rubric

Before any send, score each prospect:

1. **Fit:** explicit automation/API reliability problem and a corporate domain.
2. **Trigger:** a dated public post, product change, outage, or migration that
   makes the problem timely.
3. **Specificity:** one verifiable observation, no scraping or guessing.
4. **Offer:** fixed scope, price, deliverable, and an easy interest/no-thanks
   reply; no claim that work has already been performed.
5. **Exit:** clear sender identity, postal address, and one-line opt-out.

Send one message per qualified prospect, keep it short, do not attach files or
track opens, and stop on any opt-out, bounce, spam warning, or ambiguous
provider result. Any follow-up is a separate experiment and approval.

## Readiness gaps before the approved ten-contact batch

- Owner must provide the NeuraTech postal address for the commercial-message
  footer; it is not present in the runtime or repository and must not be
  guessed.
- Verify that the AgentMail sender identity/authentication is acceptable for
  the target domains and that an unsubscribe endpoint/header can be used. Until
  then, keep the approved batch paused even though its Agent OS approval exists.
- Re-rank the existing 20 leads using the rubric, deduplicate against prior
  effect-linked messages, and draft (not send) one tailored message per lead.

## OSINT result

The public-route review is recorded in
`research/osint-public-contact-routes-2026-08-10.md`. HiphopKR and Videngineer
have published corporate routes but were already contacted once; Nilesh
Technologies exposes only a Reddit DM route and is excluded. This confirms that
public role/company inboxes are useful for discovery, but it does not justify a
second message or private-address enrichment.

## Kill criteria

Stop the lane after any provider spam warning, one hard bounce, one opt-out
without a functioning suppression record, or zero qualified replies after the
ten-message pilot. Revenue remains zero until a paid pilot settles and is
reconciled in Agent OS.
