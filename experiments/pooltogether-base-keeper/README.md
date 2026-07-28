# PoolTogether Base Keeper — Read-Only Evidence Experiment

This experiment measures historical PrizePool claimer activity without creating a
wallet, holding a private key, signing a transaction, or spending money.

It queries the active Base PrizePool deployment from PoolTogether's published
deployment list:

- PrizePool: `0x45b2010d8a4f08b53c9fa7544c51dfd9733732cb`
- ClaimedPrize topic:
  `0x81d4e3306aa30f56dc9c3949abd8c27539b445f9ef380425f39f3f7114888e4f`

Run:

```bash
node experiments/pooltogether-base-keeper/read-only-claims.mjs --days 7
```

Use a different public RPC if the default endpoint is rate-limited:

```bash
BASE_RPC_URL=https://your-read-only-rpc.example \
  node experiments/pooltogether-base-keeper/read-only-claims.mjs --days 30
```

The report includes:

- Claim event and transaction counts.
- Reward totals by `claimRewardRecipient`.
- Successful transaction gas in native ETH.
- Concentration of successful claim rewards.
- A list of the most rewarded recipients.

It intentionally does **not** report “profit.” Rewards are denominated in the Prize
Pool's prize token while gas is denominated in ETH. A valid profit report needs
historical token and ETH prices at each transaction timestamp, failed-race
transactions, RPC/hosting costs, and tax/accounting treatment.

## Advance criteria

Do not add a key or transaction-sending code to this experiment.

A separately reviewed simulator may be considered only after:

1. At least 30 days of successful claim evidence has been collected.
2. Failed/superseded transactions by competing operators are measured.
3. Historical USD prices are applied at block time.
4. A conservative net-profit lower bound is positive.
5. The Agent OS commercial gate and a bounded gas/loss approval are active.

