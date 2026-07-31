import test from 'node:test';
import assert from 'node:assert/strict';
import { ETHEREUM_MAINNET_CHAIN_ID, requestInjectedWalletAccount, selectInjectedEthereumProvider } from '../src/wallet-browser.ts';

function provider(fields: Record<string, unknown> = {}) {
  return {
    async request() { return []; },
    ...fields,
  };
}

test('selects a directly injected MetaMask provider', () => {
  const metamask = provider({ isMetaMask: true });

  assert.equal(selectInjectedEthereumProvider({ ethereum: metamask }), metamask);
});

test('prefers the native MetaMask provider from an injected provider list', () => {
  const coinbase = provider({ isMetaMask: false, info: { name: 'Coinbase Wallet', rdns: 'com.coinbase.wallet' } });
  const metamask = provider({ isMetaMask: true });

  assert.equal(selectInjectedEthereumProvider({ ethereum: { providers: [coinbase, metamask] } }), metamask);
});

test('recognizes EIP-6963 MetaMask rdns provider metadata', () => {
  const rabby = provider({ info: { name: 'Rabby Wallet', rdns: 'io.rabby' } });
  const metamask = provider({ info: { name: 'MetaMask', rdns: 'io.metamask' } });

  assert.equal(selectInjectedEthereumProvider({ ethereum: { providers: [rabby, metamask] } }), metamask);
});

test('recognizes MetaMask provider name metadata when rdns is missing', () => {
  const other = provider({ info: { name: 'Frame' } });
  const metamask = provider({ info: { name: 'MetaMask Flask' } });

  assert.equal(selectInjectedEthereumProvider({ ethereum: { providers: [other, metamask] } }), metamask);
});

test('falls back to the first injected provider when no MetaMask marker exists', () => {
  const first = provider({ info: { name: 'Unknown Wallet' } });
  const second = provider({ info: { name: 'Another Wallet' } });

  assert.equal(selectInjectedEthereumProvider({ ethereum: { providers: [first, second] } }), first);
});

test('returns null when no injected wallet provider exists', () => {
  assert.equal(selectInjectedEthereumProvider({}), null);
  assert.equal(selectInjectedEthereumProvider({ ethereum: { providers: [] } }), null);
});

test('requests an account without switching when already on mainnet', async () => {
  const calls: Array<{ method: string; params?: unknown[] }> = [];
  const provider = {
    async request(input: { method: string; params?: unknown[] }) {
      calls.push(input);
      if (input.method === 'eth_requestAccounts') return ['0xAbC'];
      if (input.method === 'eth_chainId') return ETHEREUM_MAINNET_CHAIN_ID;
      throw new Error(`unexpected method ${input.method}`);
    },
  };

  assert.equal(await requestInjectedWalletAccount(provider), '0xAbC');
  assert.deepEqual(calls, [
    { method: 'eth_requestAccounts' },
    { method: 'eth_chainId' },
  ]);
});

test('requests an account from the injected provider and switches to mainnet when needed', async () => {
  const calls: Array<{ method: string; params?: unknown[] }> = [];
  const provider = {
    isMetaMask: true,
    async request(input: { method: string; params?: unknown[] }) {
      calls.push(input);
      if (input.method === 'eth_requestAccounts') return ['0xAbC'];
      if (input.method === 'eth_chainId') return '0x5';
      if (input.method === 'wallet_switchEthereumChain') return null;
      throw new Error(`unexpected method ${input.method}`);
    },
  };

  assert.equal(await requestInjectedWalletAccount(provider), '0xAbC');
  assert.deepEqual(calls, [
    { method: 'eth_requestAccounts' },
    { method: 'eth_chainId' },
    { method: 'wallet_switchEthereumChain', params: [{ chainId: ETHEREUM_MAINNET_CHAIN_ID }] },
  ]);
});

test('rejects when MetaMask does not return an account', async () => {
  await assert.rejects(
    requestInjectedWalletAccount({ async request() { return []; } }),
    /did not return an account/,
  );
});
