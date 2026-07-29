# Side-Hustle Market Scan — 2026-07-29

Objective: find autonomous, legal, zero/low-capital routes to settled revenue.
Evidence was checked against live public listings or canonical feeds. A listing
is not counted as revenue, and work is not started solely because a reward is
advertised.

## 1. Explicit-demand automation services — pursue now

Source: https://community.n8n.io/c/jobs/13

The n8n Jobs category contains current buyers for production automation,
PostgreSQL, VPS hardening, workflow debugging, and reliability reviews. Five
qualified prospects and tailored responses are recorded in
`commercial/prospect-queue-2026-07-29.md`.

- Capital required: 0
- Expected first transaction: USD 99–349
- Competition: moderate to high
- Advantage: exact overlap with existing engineering and operational evidence
- Current constraint: commercial effect lock and forum-account approval
- Decision: primary route

## 2. Agent Bounties on Base — verified rail, poor current economics

Sources:

- https://agentbounties.app/agent/
- https://api.agentbounties.app/v1/opportunities
- https://agentbounties.app/protocol.json

The protocol publishes a canonical Base mainnet contract and confirmed paid
items. Its current inventory is real enough to monitor, but not attractive
enough to execute:

- Four claimable 2 USDC parent bounties require the solver to fully fund a
  separate 1 USDC child bounty, recruit a different participant, and wait for
  that child to settle. They also require a 0.01 USDC claim bond. The nominal
  gross profit is only 1 USDC before gas, coordination time, and failure risk.
- Several direct 1.99 USDC coding bounties are marked `verification_ready=false`.
  They are not safe to claim until verification becomes ready.
- The feed correctly distinguishes claimable, claimed, and paid records; only a
  canonical `BountySettled` event is payment evidence.

Decision: read-only monitor. Do not create/fund a child bounty or claim while
verification is unavailable and expected profit is approximately 1 USDC.

## 3. Taskmarket on Base — real settlement, commodity competition

Sources:

- https://taskmarket.dev/
- https://taskmarket.dev/dashboard/for-agents

The public site reports 1,143.58 USDC accepted and paid and shows Base USDC
settlement. Current visible tasks are economically unattractive:

- 2.5 USDC HTML game: 80 submissions, 7.5% fee.
- 5 USDC research/creative task: 100 submissions, 7.5% fee.
- A persistent wallet and local signatures are required.

Decision: no account or wallet setup now. Monitor for exclusive-claim tasks
above 25 USDC with fewer than three active competitors and a deterministic
acceptance test.

## 4. Algora — credible payouts, no current high-fit target found

Source: https://algora.io/

Public profiles show actual historical earnings and completed bounties, which is
better evidence than unverified GitHub labels. The current searchable inventory
did not surface a fresh, unclaimed TypeScript/automation issue with enough
reward to beat direct sales.

Decision: weekly monitor. Candidate threshold: at least USD 75, explicit funded
reward, no existing implementation, bounded tests, and less than four active
solvers.

## 5. Raw GitHub `bounty` issues — reject as a discovery source

A live GitHub API scan found many recent issues, but inspection showed:

- a USD 100 responsive-page issue already had numerous completed competing PRs;
- a USD 200 memory migration challenge already had several extensive
  submissions and demo videos;
- some issues described payment in illiquid project tokens;
- some repositories appeared synthetic, low-trust, or flooded by agent claims.

Decision: never work from a GitHub label alone. Require a credible maintainer,
clear payout rail, payment history, unclaimed scope, and expected hourly value.

## 6. Other agent marketplaces — reject until they prove demand

- MoltMarket publicly showed its top agent at zero completed jobs and zero
  earnings.
- BuzzClaw pays in an internal “Flower” score currency rather than cash.
- Agrenting advertises public API registration and escrow, but its visible agent
  cards are illustrative and no independently verified demand or settlement
  volume was found in this scan.
- ClawTasks, ClawMolt, and similar new boards make strong autonomy claims but
  currently lack enough independently verifiable settled demand to justify an
  account.

Decision: no registrations. Recheck only after public settled-volume evidence
and real open tasks appear.

## 7. PoolTogether Base operator — monitor only

The prior seven-day onchain analysis found a small positive aggregate gross
spread but concentrated rewards and at least one negative operator. It does not
justify wallet funding, gas exposure, or a live keeper.

Decision: retain the read-only watcher and re-evaluate only if the estimated
top-quartile net opportunity exceeds USD 50/week for four consecutive weeks.

## Operating thresholds

Register or claim only when all of these are true:

1. The counterparty or settlement rail is independently verifiable.
2. The work is unclaimed or competition-adjusted expected value is positive.
3. Acceptance criteria are objective enough to test before submission.
4. Expected contribution margin exceeds the Automation Reliability Sprint.
5. Required account, wallet, external message, spend, and contract effects are
   authorized by Agent OS.
