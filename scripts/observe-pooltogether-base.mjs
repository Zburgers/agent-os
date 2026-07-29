#!/usr/bin/env node

// Signer-free observation only. This script never accepts a private key and
// never constructs or submits a transaction.

import { Interface } from 'ethers';

const chainId = 8453;
const prizePool = '0x45b2010d8a4f08b53c9fa7544c51dfd9733732cb';
const claimer = '0xcdce635b774de77cdf791647601dba64a75547ba';
const winnersRepository = 'GenerationSoftware/pt-v5-winners';
const rpcUrl = process.env.POOLTOGETHER_BASE_RPC_URL ?? 'https://mainnet.base.org';
const rpcUrls = [...new Set([rpcUrl, 'https://base-rpc.publicnode.com'])];
let rpcProviderUsed = rpcUrl;
const githubHeaders = process.env.GITHUB_TOKEN
  ? { authorization: `Bearer ${process.env.GITHUB_TOKEN}` }
  : {};

async function getJson(url, init = {}) {
  const response = await fetch(url, { ...init, signal: AbortSignal.timeout(20_000) });
  if (!response.ok) throw new Error(`request_failed:${response.status}:${new URL(url).hostname}`);
  return response.json();
}
async function rpcRequest(body) {
  let lastError;
  for (const url of rpcUrls) {
    try {
      const response = await getJson(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      rpcProviderUsed = url;
      return response;
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError ?? new Error('rpc_providers_unavailable');
}
async function rpc(method, params = []) {
  const response = await rpcRequest({ jsonrpc: '2.0', id: 1, method, params });
  if (response.error) throw new Error(`rpc_failed:${method}:${response.error.code}`);
  return response.result;
}
function hexNumber(value) {
  return Number(BigInt(value));
}
function delay(milliseconds) {
  return new Promise(resolve => setTimeout(resolve, milliseconds));
}
async function readContract(address, iface, functionName) {
  const data = iface.encodeFunctionData(functionName);
  const result = await rpc('eth_call', [{ to: address, data }, 'latest']);
  return iface.decodeFunctionResult(functionName, result)[0];
}
async function readContractWithArgs(address, iface, functionName, args) {
  const data = iface.encodeFunctionData(functionName, args);
  const result = await rpc('eth_call', [{ to: address, data }, 'latest']);
  return iface.decodeFunctionResult(functionName, result)[0];
}
async function readContractBatch(address, iface, functionName, argumentLists) {
  const requests = argumentLists.map((args, index) => ({
    jsonrpc: '2.0',
    id: index + 1,
    method: 'eth_call',
    params: [{ to: address, data: iface.encodeFunctionData(functionName, args) }, 'latest'],
  }));
  if (!requests.length) return [];
  const responses = await rpcRequest(requests);
  if (!Array.isArray(responses) || responses.length !== requests.length) {
    throw new Error('rpc_batch_incomplete');
  }
  const byId = new Map(responses.map(response => [response.id, response]));
  return requests.map(request => {
    const response = byId.get(request.id);
    if (!response || response.error) throw new Error(`rpc_batch_failed:${request.id}`);
    return iface.decodeFunctionResult(functionName, response.result)[0];
  });
}

const drawRoot = `winners/vaultAccounts/${chainId}/${prizePool}/draw`;
const [repository, draws] = await Promise.all([
  getJson(`https://api.github.com/repos/${winnersRepository}`, { headers: githubHeaders }),
  getJson(`https://api.github.com/repos/${winnersRepository}/contents/${drawRoot}`, {
    headers: githubHeaders,
  }),
]);
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

const prizePoolInterface = new Interface([
  'function getLastAwardedDrawId() view returns (uint24)',
  'function prizeToken() view returns (address)',
  'function wasClaimed(address,address,uint8,uint32) view returns (bool)',
]);
const [
  rpcChain,
  blockHex,
  gasPriceHex,
  prizePoolCode,
  claimerCode,
  ethSpot,
  onchainDrawId,
  prizeToken,
] = await Promise.all([
  rpc('eth_chainId'),
  rpc('eth_blockNumber'),
  rpc('eth_gasPrice'),
  rpc('eth_getCode', [prizePool, 'latest']),
  rpc('eth_getCode', [claimer, 'latest']),
  getJson('https://api.coinbase.com/v2/prices/ETH-USD/spot'),
  readContract(prizePool, prizePoolInterface, 'getLastAwardedDrawId'),
  readContract(prizePool, prizePoolInterface, 'prizeToken'),
]);
if (hexNumber(rpcChain) !== chainId) throw new Error(`unexpected_chain:${hexNumber(rpcChain)}`);
const liveDrawId = Number(onchainDrawId);
const publishedDrawLag = liveDrawId - drawId;
const dataStale = repository.archived === true || publishedDrawLag !== 0;
const currentWinnersUrl = `https://poolexplorer.xyz/${chainId}-${prizePool}-draw${liveDrawId}`;
let currentWinnerRows = 0;
let currentPrizeIndices = 0;
let highestValuePrizesChecked = 0;
let highestValuePrizesUnclaimed = 0;
let currentDataError = null;
try {
  const current = await getJson(currentWinnersUrl);
  const wins = Array.isArray(current.wins) ? current.wins : [];
  currentWinnerRows = wins.length;
  currentPrizeIndices = wins.reduce(
    (sum, win) => sum + (Array.isArray(win.i) ? win.i.length : 0),
    0,
  );
  const highestValueCandidates = wins
    .filter(win => Number(win.t) <= 3)
    .flatMap(win => (Array.isArray(win.i) ? win.i : []).map(index => ({
      vault: win.v,
      winner: win.p,
      tier: Number(win.t),
      index: Number(index),
    })));
  const claimArguments = highestValueCandidates.map(candidate =>
    [candidate.vault, candidate.winner, candidate.tier, candidate.index]);
  // The official public Base endpoint is deliberately rate-limited. Leave a
  // small gap after the chain metadata reads before the bounded state batch.
  await delay(500);
  let claimedStates;
  try {
    claimedStates = await readContractBatch(
      prizePool,
      prizePoolInterface,
      'wasClaimed(address,address,uint8,uint32)',
      claimArguments,
    );
  } catch {
    claimedStates = [];
    for (const args of claimArguments) {
      await delay(1_100);
      claimedStates.push(await readContractWithArgs(
        prizePool,
        prizePoolInterface,
        'wasClaimed(address,address,uint8,uint32)',
        args,
      ));
    }
  }
  highestValuePrizesChecked = claimedStates.length;
  highestValuePrizesUnclaimed = claimedStates.filter(claimed => !claimed).length;
} catch (error) {
  currentDataError = error instanceof Error ? error.message.slice(0, 300) : 'current_data_failed';
}

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
  prize_token: prizeToken,
  onchain_last_awarded_draw: liveDrawId,
  latest_published_draw: drawId,
  published_draw_lag: publishedDrawLag,
  winners_repository_archived: repository.archived === true,
  winners_repository_pushed_at: repository.pushed_at,
  data_stale: dataStale,
  vault_files: vaultFiles.length,
  vaults_with_prize_candidates: vaultsWithCandidates,
  winner_accounts: winnerAccounts,
  prize_candidates: prizeCandidates,
  current_winner_rows: currentWinnerRows,
  current_prize_indices: currentPrizeIndices,
  highest_value_tiers_checked: [2, 3],
  highest_value_prizes_checked: highestValuePrizesChecked,
  highest_value_prizes_unclaimed: highestValuePrizesUnclaimed,
  current_data_error: currentDataError,
  actionable_profit_observations: 0,
  limitation: dataStale
    ? 'The public winner dataset is archived or does not match the live awarded draw. Historical candidates are non-actionable; no claimed-state, fee, gas, or profit inference is permitted.'
    : 'Published winner candidates are not yet cross-checked for claimed state or current VRGDA reward; no profit claim is made.',
  sources: {
    deployments: 'https://dev.pooltogether.com/protocol/deployments/base/',
    winners: `https://github.com/${winnersRepository}/tree/main/${drawRoot}/${drawId}`,
    current_winners: currentWinnersUrl,
    rpc: rpcProviderUsed,
    eth_usd: 'https://api.coinbase.com/v2/prices/ETH-USD/spot',
  },
}));
