# Security boundary and self-hosting threat model

## Keys and signing

Seed phrases, private keys and WIF belong to active browser-memory wallet/transfer state only. Wallet derivation and signing are browser operations. Do not put signing material in HTTP requests, logs, analytics, browser storage, cookies, screenshots or support reports. Generated seed backup is explicitly revealed by the user; importing a mnemonic keeps only the derived signing material after the import form is cleared.

The browser verifies signing-key correspondence to the selected sender, checks transaction intent, calculates transaction identity locally, and presents a human-readable review. UTXO, EVM and TRON transactions retain distinct encoding and validation rules.

Memory-only is not a secure enclave: JavaScript strings cannot be reliably zeroed, garbage collection is not immediate, browser extensions/devtools/clipboard and a compromised device can expose keys. Use a clean, trusted browser and operating system. Never use the public deterministic test vectors for funds.

## Default ChainCourier infrastructure

The default Symfony runtime provides public chain data, fee/resource information, public-intent preparation and supported status lookups. It has no supported wallet signing, custody, exchange, swap or bridge operation. It does not expose a transaction broadcast API or publish signed user transactions. Signed bytes are not sent to Symfony for publication.

Removing the broadcaster does not make a hosted frontend trustless. An operator controlling delivered JavaScript can replace the application and steal future secrets entered into that page. Self-host and verify the source/build if that threat matters. This boundary describes the reviewed application behavior, not an inability of a malicious software distributor to change it.

The public-state gateway remains useful for preparation/balance lookup, but is not a transaction-publication intermediary. Existing routes can publish signed payloads via a directly accessible user-selected provider or export them for external publication without calling a ChainCourier broadcast endpoint.

## Publication is controlled by the user

Signing never publishes. The user explicitly submits the already-signed payload to a selected direct provider/node, or explicitly exports it for external publication. Providers can associate a public transaction with the user's IP and can censor, delay or misreport requests. They cannot change signed transaction intent without invalidating the signature, but preparation data still needs validation before signing.

A signed transaction is not a private key, but is an authorization to execute that transaction. Anyone receiving valid signed bytes may publish them. Export only to a destination you trust, and protect exported files until you intend publication. ChainCourier does not automatically save transaction files.

Custom broadcast endpoints are held in active UI memory, not browser storage. Never embed secret provider keys in Vite variables or the frontend bundle. Prefer browser-accessible endpoints without credentials. If authentication is required, use infrastructure you control and understand that any credential entered into the page is accessible to its JavaScript. CORS, rate limits and authentication may prevent browser publication; do not work around those restrictions by forwarding signed bytes through the default Symfony backend. Use the signed-payload export instead.

No optional relay is included or required by this implementation. A separately operated relay is a different trust/deployment decision, not an implicit fallback.

A transport error or timeout does not prove rejection. Retain the identical signed payload and local identity; check network status and explicitly retry those bytes where valid. Do not automatically change fees, nonce, inputs, TAPOS or expiry, rebuild, re-sign, choose another route or switch endpoints. TRON expiry may require a fresh preparation and a new explicit signing decision; an expired transaction is not silently replaced.

Acceptance by a provider is not execution success. In particular TRON observation, block inclusion, solidification and contract execution outcome must not be conflated. Unknown transaction data remains unknown.

## Route separation

Ethereum ETH and USDT ERC-20 share the `ethereum-mainnet` wallet identity, with asset-route-specific balances and transfer adapters. USDT TRC-20 uses the separate `tron-mainnet` identity. Selecting USDT's network does not move or convert tokens and never falls back between Ethereum and TRON. Gas/resources are paid in ETH or TRX respectively.

## Deployment and public-release checklist

- Keep operator `.env` files, provider credentials, private endpoint URLs and backups outside Git. Tracked examples must contain placeholders or non-secret development defaults only.
- Backend RPC URLs may contain credentials; supply them at runtime, do not log them or expose them through API errors. They are public-state providers, not browser broadcast credentials.
- Treat `compose.yaml` as a local development stack, not a production-hardening recipe: choose HTTPS, production debug settings, access controls, logging policy and appropriate resource/rate limits before exposing it.
- Inspect tracked files, reachable history, deployment files, CI references and the built frontend before changing repository visibility. Secret scanning findings must be classified rather than hidden by broad path exclusions.
- Rotate/revoke a real credential if it ever appeared in Git; deleting a current file does not remove history. Do not rewrite published history or change repository visibility automatically.
- Pin and review dependencies; deterministic vectors do not replace dependency or deployment review.
- Use no funded mainnet transaction as a required test oracle.

These are technical properties and operating assumptions, not legal or regulatory assurances.
