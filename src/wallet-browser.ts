export const ETHEREUM_MAINNET_CHAIN_ID = '0x1';

type EthereumProvider = {
  isMetaMask?: boolean;
  info?: { name?: string; rdns?: string };
  providers?: EthereumProvider[];
  request(input: { method: string; params?: unknown[] }): Promise<unknown>;
};

function isMetaMaskProvider(provider: EthereumProvider) {
  const rdns = provider.info?.rdns?.toLowerCase() ?? '';
  const name = provider.info?.name?.toLowerCase() ?? '';
  return provider.isMetaMask === true || rdns.includes('metamask') || name.includes('metamask');
}

export function selectInjectedEthereumProvider(source: { ethereum?: EthereumProvider } = globalThis as any) {
  const injected = source.ethereum;
  if (!injected) return null;
  if (Array.isArray(injected.providers)) return injected.providers.find(isMetaMaskProvider) ?? injected.providers[0] ?? null;
  return injected;
}

export async function requestInjectedWalletAccount(provider: EthereumProvider) {
  const accounts = await provider.request({ method: 'eth_requestAccounts' });
  const account = Array.isArray(accounts) ? accounts[0] : null;
  if (typeof account !== 'string' || !account) throw new Error('MetaMask did not return an account.');
  const chainId = await provider.request({ method: 'eth_chainId' });
  if (chainId !== ETHEREUM_MAINNET_CHAIN_ID) {
    await provider.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: ETHEREUM_MAINNET_CHAIN_ID }] });
  }
  return account;
}
