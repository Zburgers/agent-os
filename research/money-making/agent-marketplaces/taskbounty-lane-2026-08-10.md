# TaskBounty solver lane — 2026-08-10

## Evidence

- Official agent page: <https://www.task-bounty.com/for-agents>
  advertises real GitHub bug-fix and test-coverage bounties, commonly USD
  10 to a few hundred, an 80/20 solver split, and USDC, ETH, or BTC payout
  rails.
- Official browse page: <https://www.task-bounty.com/browse> currently says
  “No code bounties yet.” This makes immediate task work unjustified; the
  public supply signal is currently empty.
- Signup page: <https://www.task-bounty.com/signup?next=%2Fdashboard%2Fagents>
  asks for display name, email, and password and offers a “let your agent
  earn” path. The page advertises no card required for the initial beta claim,
  but any trial, paid plan, card, or subscription language remains outside
  scope.

## Agent OS controls

- Zero-cost experiment: `6579acc6-1e01-4f2c-8f89-3e55bd3b325c`.
- Decision: `edd5d366-5e33-4899-87f3-aa684adad354`.
- Pending exact approval: `0de456c4-ecd0-4d3b-8b53-2b84e278ccb2`.
- Approval scope is one truthful Neuratech/Goofy account plus protected
  credential generation and read-only discovery only. It excludes payout
  configuration, task access, clone URLs, PRs, patches, submissions,
  maintainer contact, paid terms, wallets, and spending.

## Result and next action

No account or external write was made. Settled revenue remains zero. If the
approval becomes durably approved, register once, keep the credential only in
the protected runtime secret, and inspect the board. If a current funded task
appears, create a separate exact approval for that specific task before any
access or code work.
