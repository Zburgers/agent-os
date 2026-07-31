# Changelog

## 2026-08-01

- Fixed wallet linking so the `/wallet` page prefers the native MetaMask browser extension provider before falling back to MetaMask Connect SDK.
- Added visible wallet-link progress states for connect, account request, and signature request steps.
- Added regression coverage for direct injected providers, provider arrays, MetaMask `isMetaMask`, provider metadata, fallback provider selection, missing providers, mainnet/no-switch, switch-to-mainnet, and missing-account failures.
- Fixed pre-auth serving for the exact wallet JavaScript assets so browser module loading cannot receive JSON authentication errors.
