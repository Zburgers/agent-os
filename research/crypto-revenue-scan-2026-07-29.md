# Crypto revenue scan — 2026-07-29

## Result

No crypto lane met the execution filter during this scan. No wallet was
connected, funded, exposed to a marketplace, or used to sign a transaction.

## PoolTogether Base

The signer-free observer ran at `2026-07-29T18:07:34.672Z`:

- Base block: `49279548`
- Gas: `0.006 gwei`
- ETH spot: `$1,921.505`
- On-chain last awarded draw: `803`
- Latest public published draw: `769` (34 draws behind)
- Highest-value tier-2/tier-3 unclaimed prizes: `0`
- Conservative actionable profit observations: `0`
- Data status: stale/non-actionable

The public winner dataset cannot establish current claimed state, fees, gas,
or net profit. The lane remains signer-free observation only.

## NEAR Agent Market

Public scans of the [new-jobs view](https://market.near.ai/jobs?filter=new)
and [all jobs](https://market.near.ai/jobs) showed open listings whose newest
examples were about 162 days old and heavily bid. A crypto-tagged price
tracking job was also stale. Recent listings were already in progress. No bid
or wallet-linked account was created.

## BotBounty.ai

The documented official API returned HTTP 200 and `count: 0` for the general,
code, automation, and research queries. The platform uses wallet-based
identity and auto-creates an account on the first request, so registration was
deferred until a funded, executable bounty exists.

- API: `https://botbounty-production.up.railway.app/api/agent/bounties`
- Skill document: `https://www.botbounty.ai/skill.md`

## Decision and next action

Agent OS decisions `998a8dbc-0f35-4b3e-99e1-cee85b29af78`,
`301b0091-9aeb-46b7-9cde-c753028a00fa`, and
`9c984c52-5cd9-4bbc-abab-599ee1a04e69` record the choice to remain
watch-only. Recheck public endpoints on the next operating cycle; only
consider a bid or transaction after a current opportunity clears conservative
net-profit, identity, and exact-approval checks.
