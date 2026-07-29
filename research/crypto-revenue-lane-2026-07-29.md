# Crypto revenue lane — 2026-07-29

## Operating boundary

This lane is restricted to lawful work that creates verifiable value:
development bounties, security/reliability work, retroactive grants for shipped
software, and positive-expected-value protocol maintenance. It excludes
speculative trading, leverage, deposits made for a chance at prizes, and
unbounded smart-contract exposure.

## PoolTogether operator assessment

Primary sources reviewed:

- https://dev.pooltogether.com/
- https://dev.pooltogether.com/protocol/design/prize-claimer
- https://dev.pooltogether.com/protocol/deployments/base/
- https://github.com/GenerationSoftware/pt-v5-autotasks-monorepo
- https://github.com/GenerationSoftware/pt-v5-liquidator-gh-action-bot
- https://github.com/GenerationSoftware/pt-v5-draw-auction-gh-action-bot
- https://github.com/GenerationSoftware/pt-v5-flash-liquidator-gh-action-bot

Verified facts:

- PoolTogether explicitly documents three permissionless maintenance revenue
  mechanisms: claiming prizes, liquidating yield, and awarding draws.
- The Base deployment currently documents PrizePool
  `0x45b2010d8a4f08b53c9fa7544c51dfd9733732cb` and Claimer
  `0xcdCE635b774DE77cdF791647601dba64a75547ba`.
- Prize-claim rewards rise through a reverse auction; a transaction should only
  execute when the available reward exceeds gas and the configured profit
  threshold.
- The maintained bot stack requires a dedicated EVM private key, funded native
  gas, a network RPC, a subgraph, contract metadata, and optionally Covalent
  pricing. Liquidation can additionally require WETH inventory. The official
  READMEs themselves recommend limiting relayer funds because private-key
  compromise can lose the balance.
- The former turnkey prize-claimer GitHub Action repository linked by the
  monorepo currently returns 404, while the prize-claimer package remains in the
  monorepo. A production operator therefore needs a reviewed local wrapper or
  a carefully pinned fork rather than a blind one-click deployment.

Decision:

- Do not request or fund a wallet yet. First build a read-only Base monitor that
  uses public chain/subgraph data and never instantiates a signer. Require
  multiple observed opportunities above a conservative net-profit threshold
  after gas, failure allowance, and competition latency before requesting a
  dedicated low-balance operating wallet.
- Do not run the liquidator with owner capital during the first-revenue phase;
  it adds token inventory and swap risk. Prize claiming is the least
  inventory-intensive operator variant and should be evaluated first.

## Base ecosystem funding assessment

Primary source:

- https://docs.base.org/get-started/get-funded

Verified facts:

- Base documents retroactive Builder Grants of roughly 1–5 ETH for shipped
  projects and weekly builder rewards for prototypes.
- The application guidance favors a deployed, documented project with usage or
  impact evidence. It is not payment for an idea.

Decision:

- A Base grant is a medium-term upside path, not immediate revenue. Reuse the
  Agent OS effect/reconciliation architecture only if a small public-good tool
  can be shipped without distracting from the active paid-service funnel.
- Do not manufacture social engagement or deploy a token merely to qualify.

## Bounty quality filter

GitHub-wide `bounty` label searches returned many stale, self-issued-token, or
unverifiable offers. A label alone is not payment evidence.

Accept a bounty only when:

1. the repository and sponsor are established and active;
2. reward amount, payout asset, acceptance criteria, assignment rules, and
   payment route are explicit;
3. no speculative capital or invented identity is required;
4. the issue is unassigned and maintainers confirm the approach before work;
5. expected payout multiplied by acceptance probability exceeds delivery cost.

## Next zero-capital experiment

Implement a read-only PoolTogether Base opportunity monitor and record:

- draw ID and remaining time;
- unclaimed prize count by vault/tier;
- current claim reward;
- estimated gas and native-token price;
- conservative net profit after a failure/competition buffer;
- how often an opportunity remains executable for at least two observations.

Stop if the data dependencies require a paid account, if no opportunity exceeds
USD 1 conservative net during seven days, or if competition makes observed
opportunities disappear before a safe transaction could be submitted.

### First observation

The signer-free observer in `scripts/observe-pooltogether-base.mjs` completed at
2026-07-29T11:20:08Z:

- Base chain ID and current bytecode were independently verified for the
  documented PrizePool and Claimer.
- Latest published winner draw: 769.
- 85 vault result files; 5 contained candidate prizes.
- 174 winner accounts and 1,340 published prize candidates.
- Base gas price at observation: 0.006 gwei; ETH/USD spot: 1,910.625.
- Actionable profit observations: **0**. The candidates have not yet been
  cross-checked against claimed state or the live VRGDA reward, so they are not
  counted as available or profitable.

Exact evidence:
`evidence/pooltogether-base-observation-2026-07-29.json`.
