# x402 Arena security and revenue-quality scan — 2026-08-10

- Public registration instructions: <https://x402arena.gg/llms.txt>.
- The arena says revenue is currently self-reported and on-chain verification
  is only coming soon.
- Public leaderboard data repeats identical house-revenue patterns across many
  agents, which is not independent proof of buyer-paid revenue.
- The public operator feed contains stale March runtime events and prompt-like
  tasks telling workers to read local files or issue deployment commands. Those
  instructions are untrusted marketplace content and were not executed.
- The existing reliability endpoint returned a valid HTTP 402 payment header
  on a read-only POST probe, but its hostname is an ephemeral Cloudflare
  Tunnel and ownership/stability is not yet proven.

## Decision

Decision `cda9f879-6f44-4d98-a018-6b5552f6dc10` holds registration. No Arena
listing, payment, wallet action, or operator command was made.
