#!/usr/bin/env node

/**
 * Read-only PoolTogether PrizePool claim activity analyzer for Base.
 *
 * Safety boundary: this file contains no private-key handling, signing, or
 * transaction submission. It uses JSON-RPC reads only.
 */

const DEFAULT_RPC = "https://mainnet.base.org";
const DEFAULT_PRIZE_POOL = "0x45b2010d8a4f08b53c9fa7544c51dfd9733732cb";
const CLAIMED_PRIZE_TOPIC =
  "0x81d4e3306aa30f56dc9c3949abd8c27539b445f9ef380425f39f3f7114888e4f";
const MAX_LOG_RANGE = 10_000;

function parseArgs(argv) {
  const result = {
    days: 7,
    rpc: process.env.BASE_RPC_URL || DEFAULT_RPC,
    prizePool: DEFAULT_PRIZE_POOL,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--days") {
      result.days = Number(argv[++index]);
    } else if (argument === "--rpc") {
      result.rpc = argv[++index];
    } else if (argument === "--prize-pool") {
      result.prizePool = argv[++index];
    } else if (argument === "--help" || argument === "-h") {
      console.log(
        "Usage: read-only-claims.mjs [--days 7] [--rpc URL] [--prize-pool ADDRESS]",
      );
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${argument}`);
    }
  }

  if (!Number.isFinite(result.days) || result.days <= 0 || result.days > 365) {
    throw new Error("--days must be greater than 0 and at most 365");
  }
  if (!/^0x[0-9a-fA-F]{40}$/.test(result.prizePool)) {
    throw new Error("--prize-pool must be a 20-byte hex address");
  }
  return result;
}

function hexToBigInt(value) {
  return BigInt(value || "0x0");
}

function quantity(value) {
  return `0x${BigInt(value).toString(16)}`;
}

function word(data, index) {
  const start = 2 + index * 64;
  return `0x${data.slice(start, start + 64)}`;
}

function wordAddress(data, index) {
  return `0x${word(data, index).slice(-40)}`.toLowerCase();
}

function topicAddress(topic) {
  return `0x${topic.slice(-40)}`.toLowerCase();
}

function formatUnits(value, decimals, maximumFractionDigits = 8) {
  const negative = value < 0n;
  const absolute = negative ? -value : value;
  const scale = 10n ** BigInt(decimals);
  const integer = absolute / scale;
  const remainder = absolute % scale;
  if (remainder === 0n || maximumFractionDigits === 0) {
    return `${negative ? "-" : ""}${integer}`;
  }
  const digits = Math.min(decimals, maximumFractionDigits);
  const fractional = remainder
    .toString()
    .padStart(decimals, "0")
    .slice(0, digits)
    .replace(/0+$/, "");
  return `${negative ? "-" : ""}${integer}${fractional ? `.${fractional}` : ""}`;
}

function decodeStringResult(result) {
  if (!result || result === "0x") return null;
  const body = result.slice(2);
  try {
    const offset = Number(BigInt(`0x${body.slice(0, 64)}`)) * 2;
    const length = Number(BigInt(`0x${body.slice(offset, offset + 64)}`));
    return Buffer.from(body.slice(offset + 64, offset + 64 + length * 2), "hex").toString(
      "utf8",
    );
  } catch {
    try {
      return Buffer.from(body.slice(0, 64), "hex")
        .toString("utf8")
        .replace(/\0+$/, "");
    } catch {
      return null;
    }
  }
}

class Rpc {
  constructor(url) {
    this.url = url;
    this.nextId = 1;
  }

  async call(method, params = []) {
    for (let attempt = 0; attempt < 7; attempt += 1) {
      const response = await fetch(this.url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: this.nextId++,
          method,
          params,
        }),
      });
      if (response.ok) {
        const payload = await response.json();
        if (payload.error) {
          throw new Error(`RPC ${method}: ${payload.error.message}`);
        }
        return payload.result;
      }
      if (response.status !== 429 && response.status < 500) {
        throw new Error(`RPC HTTP ${response.status} for ${method}`);
      }
      if (attempt === 6) {
        throw new Error(`RPC HTTP ${response.status} for ${method} after retries`);
      }
      const retryAfterSeconds = Number(response.headers.get("retry-after"));
      const delayMs = Number.isFinite(retryAfterSeconds)
        ? Math.min(10_000, retryAfterSeconds * 1_000)
        : Math.min(10_000, 500 * 2 ** attempt);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
    throw new Error(`RPC retries exhausted for ${method}`);
  }
}

async function blockTimestamp(rpc, blockNumber) {
  const block = await rpc.call("eth_getBlockByNumber", [quantity(blockNumber), false]);
  if (!block) throw new Error(`Missing block ${blockNumber}`);
  return Number(hexToBigInt(block.timestamp));
}

async function findFirstBlockAtOrAfter(rpc, low, high, targetTimestamp) {
  let left = low;
  let right = high;
  while (left < right) {
    const middle = (left + right) / 2n;
    const timestamp = await blockTimestamp(rpc, middle);
    if (timestamp < targetTimestamp) {
      left = middle + 1n;
    } else {
      right = middle;
    }
  }
  return left;
}

async function readTokenMetadata(rpc, prizePool) {
  // prizeToken(), decimals(), and symbol()
  const prizeTokenSelector = "0xd0ef024a";
  const decimalsSelector = "0x313ce567";
  const symbolSelector = "0x95d89b41";
  try {
    const tokenResult = await rpc.call("eth_call", [
      { to: prizePool, data: prizeTokenSelector },
      "latest",
    ]);
    const address = `0x${tokenResult.slice(-40)}`.toLowerCase();
    const [decimalsResult, symbolResult] = await Promise.all([
      rpc.call("eth_call", [{ to: address, data: decimalsSelector }, "latest"]),
      rpc.call("eth_call", [{ to: address, data: symbolSelector }, "latest"]),
    ]);
    return {
      address,
      decimals: Number(hexToBigInt(decimalsResult)),
      symbol: decodeStringResult(symbolResult) || "PRIZE_TOKEN",
    };
  } catch (error) {
    return {
      address: null,
      decimals: 18,
      symbol: "PRIZE_TOKEN",
      metadataError: error.message,
    };
  }
}

async function collectLogs(rpc, prizePool, fromBlock, toBlock) {
  const logs = [];
  for (let start = fromBlock; start <= toBlock; start += BigInt(MAX_LOG_RANGE)) {
    const end =
      start + BigInt(MAX_LOG_RANGE - 1) > toBlock
        ? toBlock
        : start + BigInt(MAX_LOG_RANGE - 1);
    const chunk = await rpc.call("eth_getLogs", [
      {
        address: prizePool,
        fromBlock: quantity(start),
        toBlock: quantity(end),
        topics: [CLAIMED_PRIZE_TOPIC],
      },
    ]);
    logs.push(...chunk);
  }
  return logs;
}

async function mapWithConcurrency(items, concurrency, mapper) {
  const results = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const index = next++;
      results[index] = await mapper(items[index], index);
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, () => worker()),
  );
  return results;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const rpc = new Rpc(options.rpc);
  const latestBlock = hexToBigInt(await rpc.call("eth_blockNumber"));
  const latestTimestamp = await blockTimestamp(rpc, latestBlock);
  const targetTimestamp = Math.floor(latestTimestamp - options.days * 86_400);
  const firstBlock = await findFirstBlockAtOrAfter(
    rpc,
    0n,
    latestBlock,
    targetTimestamp,
  );

  const [token, logs] = await Promise.all([
    readTokenMetadata(rpc, options.prizePool),
    collectLogs(rpc, options.prizePool, firstBlock, latestBlock),
  ]);

  const transactions = new Map();
  for (const log of logs) {
    const reward = hexToBigInt(word(log.data, 4));
    const rewardRecipient = wordAddress(log.data, 5);
    const transactionHash = log.transactionHash.toLowerCase();
    const existing = transactions.get(transactionHash) || {
      transactionHash,
      blockNumber: hexToBigInt(log.blockNumber),
      eventCount: 0,
      reward: 0n,
      rewardRecipients: new Map(),
    };
    existing.eventCount += 1;
    existing.reward += reward;
    existing.rewardRecipients.set(
      rewardRecipient,
      (existing.rewardRecipients.get(rewardRecipient) || 0n) + reward,
    );
    transactions.set(transactionHash, existing);
  }

  const transactionList = [...transactions.values()];
  const receipts = await mapWithConcurrency(transactionList, 3, async (transaction) =>
    rpc.call("eth_getTransactionReceipt", [transaction.transactionHash]),
  );

  const recipients = new Map();
  let totalReward = 0n;
  let totalL1FeeWei = 0n;
  let totalL2GasWei = 0n;
  let totalGasWei = 0n;
  for (let index = 0; index < transactionList.length; index += 1) {
    const transaction = transactionList[index];
    const receipt = receipts[index];
    const l2GasWei =
      hexToBigInt(receipt.gasUsed) * hexToBigInt(receipt.effectiveGasPrice);
    const l1FeeWei = hexToBigInt(receipt.l1Fee);
    const gasWei = l2GasWei + l1FeeWei;
    totalL2GasWei += l2GasWei;
    totalL1FeeWei += l1FeeWei;
    totalGasWei += gasWei;
    totalReward += transaction.reward;

    for (const [recipient, reward] of transaction.rewardRecipients) {
      const entry = recipients.get(recipient) || {
        address: recipient,
        reward: 0n,
        gasWei: 0n,
        events: 0,
        transactions: new Set(),
        senders: new Set(),
      };
      entry.reward += reward;
      entry.gasWei +=
        transaction.reward === 0n ? 0n : (gasWei * reward) / transaction.reward;
      entry.events += transaction.eventCount;
      entry.transactions.add(transaction.transactionHash);
      if (receipt.from) entry.senders.add(receipt.from.toLowerCase());
      recipients.set(recipient, entry);
    }
  }

  const rankedRecipients = [...recipients.values()].sort((a, b) =>
    a.reward === b.reward ? 0 : a.reward > b.reward ? -1 : 1,
  );
  const topReward = rankedRecipients[0]?.reward || 0n;

  const report = {
    generatedAt: new Date().toISOString(),
    safety: "read-only; no signing or transaction submission",
    network: "Base (chainId 8453)",
    rpcHost: new URL(options.rpc).host,
    prizePool: options.prizePool.toLowerCase(),
    prizeToken: token,
    window: {
      requestedDays: options.days,
      fromBlock: firstBlock.toString(),
      toBlock: latestBlock.toString(),
      fromTimestamp: new Date(targetTimestamp * 1000).toISOString(),
      toTimestamp: new Date(latestTimestamp * 1000).toISOString(),
    },
    totals: {
      claimEvents: logs.length,
      successfulTransactions: transactionList.length,
      uniqueRewardRecipients: recipients.size,
      claimRewardRaw: totalReward.toString(),
      claimReward: formatUnits(totalReward, token.decimals),
      claimRewardSymbol: token.symbol,
      successfulL2GasWei: totalL2GasWei.toString(),
      successfulL1FeeWei: totalL1FeeWei.toString(),
      successfulGasWei: totalGasWei.toString(),
      successfulGasEth: formatUnits(totalGasWei, 18),
      successfulGrossNetWei:
        token.address === "0x4200000000000000000000000000000000000006"
          ? (totalReward - totalGasWei).toString()
          : null,
      successfulGrossNetEth:
        token.address === "0x4200000000000000000000000000000000000006"
          ? formatUnits(totalReward - totalGasWei, 18)
          : null,
      topRecipientRewardShare:
        totalReward === 0n ? null : Number((topReward * 10_000n) / totalReward) / 100,
    },
    topRecipients: rankedRecipients.slice(0, 20).map((entry) => ({
      address: entry.address,
      rewardRaw: entry.reward.toString(),
      reward: formatUnits(entry.reward, token.decimals),
      successfulGasEth: formatUnits(entry.gasWei, 18),
      successfulGrossNetEth:
        token.address === "0x4200000000000000000000000000000000000006"
          ? formatUnits(entry.reward - entry.gasWei, 18)
          : null,
      rewardSharePercent:
        totalReward === 0n
          ? null
          : Number((entry.reward * 10_000n) / totalReward) / 100,
      transactions: entry.transactions.size,
      observedSenders: [...entry.senders],
    })),
    limitations: [
      "Gross net is emitted only when the prize token is Base WETH, which is redeemable 1:1 for ETH.",
      "Historical token and ETH prices are not applied.",
      "Failed and superseded competing transactions are not included.",
      "RPC and hosting costs are not included.",
      "Event activity does not prove that a new entrant can win the same transactions.",
    ],
  };

  console.log(JSON.stringify(report, null, 2));
}

main().catch((error) => {
  console.error(`read-only analysis failed: ${error.message}`);
  process.exitCode = 1;
});
