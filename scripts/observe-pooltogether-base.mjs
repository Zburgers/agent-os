#!/usr/bin/env node

// Signer-free observation only. This script never accepts a private key and
// never constructs or submits a transaction.

const chainId = 8453;
const prizePool = '0x45b2010d8a4f08b53c9fa7544c51dfd9733732cb';
const claimer = '0xcdce635b774de77cdf791647601dba64a75547ba';
const winnersRepository = 'GenerationSoftware/pt-v5-winners';
const rpcUrl = process.env.POOLTOGETHER_BASE_RPC_URL ?? 'https://mainnet.base.org';
const githubHeaders = process.env.GITHUB_TOKEN
  ? { authorization: `Bearer ${process.env.GITHUB_TOKEN}` }
  : {};

async function getJson(url, init = {}) {
  const response = await fetch(url, { ...init, signal: AbortSignal.timeout(20_000) });
  if (!response.ok) throw new Error(`request_failed:${response.status}:${new URL(url).hostname}`);
  return response.json();
}
async function rpc(method, params = []) {
  const response = await getJson(rpcUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  });
  if (response.error) throw new Error(`rpc_failed:${method}:${response.error.code}`);
  return response.result;
}
function hexNumber(value) {
  return Number(BigInt(value));
}

const drawRoot = `winners/vaultAccounts/${chainId}/${prizePool}/draw`;
const draws = await getJson(
  `https://api.github.com/repos/${winnersRepository}/contents/${drawRoot}`,
  { headers: githubHeaders },
);
const drawId = Math.max(...draws.map(item => Number(item.name)).filter(Number.isSafeInteger));
const vaultFiles = await getJson(
  `https://api.github.com/repos/${winnersRepository}/contents/${drawRoot}/${drawId}`,
  { headers: githubHeaders },
);
const winnerDocuments = await Promise.all(vaultFiles.map(file => getJson(file.download_url)));
let winnerAccounts = 0;
let prizeCandidates = 0;
let vaultsWithCandidates = 0;
for (const document of winnerDocuments) {
  const winners = Array.isArray(document.winners) ? document.winners : [];
  if (winners.length) vaultsWithCandidates += 1;
  winnerAccounts += winners.length;
  for (const winner of winners) {
    for (const indices of Object.values(winner.prizes ?? {})) {
      prizeCandidates += Array.isArray(indices) ? indices.length : 0;
    }
  }
}

const [rpcChain, blockHex, gasPriceHex, prizePoolCode, claimerCode, ethSpot] = await Promise.all([
  rpc('eth_chainId'),
  rpc('eth_blockNumber'),
  rpc('eth_gasPrice'),
  rpc('eth_getCode', [prizePool, 'latest']),
  rpc('eth_getCode', [claimer, 'latest']),
  getJson('https://api.coinbase.com/v2/prices/ETH-USD/spot'),
]);
if (hexNumber(rpcChain) !== chainId) throw new Error(`unexpected_chain:${hexNumber(rpcChain)}`);

console.log(JSON.stringify({
  observed_at: new Date().toISOString(),
  mode: 'read_only_no_signer',
  chain_id: chainId,
  block_number: hexNumber(blockHex),
  gas_price_gwei: Number(BigInt(gasPriceHex)) / 1e9,
  eth_usd_spot: Number(ethSpot.data.amount),
  prize_pool: prizePool,
  claimer,
  prize_pool_contract_present: prizePoolCode !== '0x',
  claimer_contract_present: claimerCode !== '0x',
  latest_published_draw: drawId,
  vault_files: vaultFiles.length,
  vaults_with_prize_candidates: vaultsWithCandidates,
  winner_accounts: winnerAccounts,
  prize_candidates: prizeCandidates,
  actionable_profit_observations: 0,
  limitation: 'Published winner candidates are not yet cross-checked for claimed state or current VRGDA reward; no profit claim is made.',
  sources: {
    deployments: 'https://dev.pooltogether.com/protocol/deployments/base/',
    winners: `https://github.com/${winnersRepository}/tree/main/${drawRoot}/${drawId}`,
    rpc: 'https://mainnet.base.org',
    eth_usd: 'https://api.coinbase.com/v2/prices/ETH-USD/spot',
  },
}));
