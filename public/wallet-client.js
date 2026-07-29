// src/wallet-client.ts
var provider;
var $ = (id) => document.getElementById(id);
var show = (value, error = false) => {
  $("walletMessage").textContent = value;
  $("walletMessage").className = error ? "error" : "";
};
var api = async (path, options = {}) => {
  const csrf = document.querySelector('meta[name="csrf-token"]')?.getAttribute("content") ?? "";
  const r = await fetch(path, { ...options, headers: { "content-type": "application/json", "x-csrf-token": csrf, ...options.headers ?? {} } });
  const b = await r.json();
  if (!r.ok) throw new Error(b.error ?? "request_failed");
  return b;
};
async function connect() {
  const key = window.__walletConfig?.infuraProjectId;
  if (!key) throw new Error("Infura project ID is not configured; signing remains disabled.");
  const { createEVMClient, getInfuraRpcUrls } = await import("/assets/metamask-connect.js");
  const client = await createEVMClient({ dapp: { name: "Goofy Agent OS", url: location.origin }, api: { supportedNetworks: getInfuraRpcUrls({ infuraApiKey: key, chainIds: ["0x1"] }) }, analytics: { enabled: false } });
  const result = await client.connect({ chainIds: ["0x1"] });
  provider = client.getProvider();
  if (result.chainId !== "0x1") throw new Error("Ethereum Mainnet is required.");
  return result.accounts[0];
}
async function load() {
  const s = await api("/api/wallet/status");
  $("walletState").textContent = s.link ? `${s.link.address} \xB7 Ethereum Mainnet` : "No wallet linked";
  $("walletBalance").textContent = s.balance_wei === null ? "Balance unavailable" : `${(Number(s.balance_wei) / 1e18).toFixed(6)} ETH`;
  const rows = s.intents.map((i) => `<tr><td>${i.purpose}</td><td><code>${i.to_address}</code><br>${(Number(i.value_wei) / 1e18).toFixed(8)} ETH</td><td>${i.data === "0x" ? "Native ETH transfer" : "<strong>Raw calldata warning</strong>"}</td><td>${i.status}<br><small>${i.submitted_hash ?? "No hash"}</small></td><td>${i.status === "draft" ? `<button data-submit="${i.id}">Submit approved draft</button>` : ""}</td></tr>`).join("");
  $("walletIntents").innerHTML = rows || '<tr><td colspan="5">No transaction drafts.</td></tr>';
  document.querySelectorAll("[data-submit]").forEach((b) => b.onclick = () => submit(b.dataset.submit));
}
async function link() {
  try {
    show("Opening MetaMask Connect\u2026");
    const n = await api("/api/wallet/link-nonce", { method: "POST", body: "{}" });
    const account = await connect();
    const signature = await provider.request({ method: "personal_sign", params: [n.message, account] });
    await api("/api/wallet/link", { method: "POST", body: JSON.stringify({ message: n.message, signature, chain_id: "0x1" }) });
    show("Wallet linked. Only the public address was stored.");
    await load();
  } catch (e) {
    show(e?.message ?? "Wallet connection failed", true);
  }
}
async function submit(id) {
  try {
    show("Preparing the approved transaction envelope\u2026");
    const intent = await api("/api/wallet/intents/" + id + "/prepare", { method: "POST", body: "{}" });
    const account = await connect();
    if (account.toLowerCase() !== intent.from.toLowerCase()) throw new Error("Connected account differs from the linked wallet; draft invalidated.");
    if (!confirm("Review the exact recipient, ETH amount, gas maximum, and raw calldata in MetaMask. Continue to MetaMask?")) return;
    try {
      const hash = await provider.request({ method: "eth_sendTransaction", params: [intent] });
      await api("/api/wallet/intents/" + id + "/result", { method: "POST", body: JSON.stringify({ hash }) });
      show("Transaction hash recorded. It will require on-chain reconciliation.");
    } catch (e) {
      if (e?.code === 4001) {
        await api("/api/wallet/intents/" + id + "/result", { method: "POST", body: JSON.stringify({ rejected: true }) });
        show("MetaMask rejected the transaction. No retry was created.");
      } else {
        show("Submission outcome is ambiguous; do not retry. Reconnect and reconcile the transaction hash.", true);
      }
    }
    await load();
  } catch (e) {
    show(e?.message ?? "Draft cannot be submitted", true);
  }
}
$("walletConnect").addEventListener("click", link);
$("walletRevoke").addEventListener("click", async () => {
  if (!confirm("Revoke this wallet link and cancel all unsubmitted drafts?")) return;
  try {
    await api("/api/wallet/revoke", { method: "POST", body: "{}" });
    show("Wallet link revoked and unsubmitted drafts cancelled.");
    await load();
  } catch (e) {
    show(e.message, true);
  }
});
load().catch((e) => show(e.message, true));
