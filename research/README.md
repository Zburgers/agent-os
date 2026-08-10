# Revenue research workspace

`RESEARCH_TRACK.md` is the shared queue for incomplete, money-relevant paths.
This directory contains supporting evidence only; it is not an approval ledger.

## Handoff protocol

1. A researcher adds one queue entry with `Status`, `Owner`, `Evidence`, a
   concrete `Revenue hypothesis`, and one `Next action`.
2. Store detailed snapshots, source notes, experiments, and candidate deliverables
   in this directory using a dated filename (`topic-YYYY-MM-DD.md`).
3. Reconcile every material external result, cost, or revenue event through the
   Agent OS MCP and summarize it in `daily-revenue-log-YYYY-MM-DD.md`.
4. A queue entry never authorizes an account, message, bid, deployment, wallet
   operation, payment, or spend. Those require an exact Agent OS approval and
   effect at execution time.
5. Keep a path until it is exhausted, intentionally utilized, or documented as
   a dead end. When closing it, record the result, lesson, and next allocation
   decision before removing it from the queue.

Never store passwords, API keys, OTPs, private keys, raw signatures, payment
details, session tokens, or unnecessary personal data here.
