const publicWalletJavaScriptAssets = new Map([
  ['/assets/wallet-client.js', 'wallet-client.js'],
  ['/assets/metamask-connect.js', 'metamask-connect.js'],
]);

export function publicJavaScriptAsset(pathname: string) {
  return publicWalletJavaScriptAssets.get(pathname) ?? null;
}
