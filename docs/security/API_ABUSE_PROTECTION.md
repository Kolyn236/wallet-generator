# API abuse protection and provider shielding

ChainCourier is non-custodial. Wallet creation, seed recovery, private-key/WIF handling and transaction signing stay in the browser. The public Symfony API handles public blockchain reads, transaction preparation and signed transaction broadcast only.

## Threat model

The relevant abuse case is automated direct traffic to `/api/...`, especially requests that consume BlockCypher or Ethereum JSON-RPC capacity. Browser form validation is not a security boundary.

The protection is deliberately layered and small:

1. Nginx applies a cheap per-source-IP flood limit before PHP.
2. Symfony applies operation-aware per-client-IP limits after routing and before controllers run.
3. Safe provider-backed reads use a short filesystem-backed cache.
4. Successful signed transaction broadcasts are deduplicated for a short bounded period.
5. A provider + chain + network + operation cooldown suppresses repeated upstream calls for 10 seconds after an upstream HTTP 429.

No user accounts, KYC, device fingerprinting, destination scoring, CAPTCHA, Redis or database are part of this design.

## Symfony limiter policies

Limits are configured centrally in `backend/config/services.yaml`.

| Operation class | Limit |
| --- | ---: |
| health and static fee policy | 120 requests/minute/IP |
| address balance, including ETH/ERC-20 | 60 requests/minute/IP |
| UTXO lookup | 30 requests/minute/IP |
| Ethereum transaction prepare | 10 requests/minute/IP |
| raw transaction broadcast | 5 requests/minute/IP |

A local application rejection returns HTTP `429` with the stable JSON error `rate_limited / too_many_requests` and a `Retry-After` header. Because the limiter is a kernel request subscriber, the controller and provider adapter are not invoked after rejection.

The application limiter uses a dedicated pool backed by the current filesystem `cache.app`. It is intentionally single-instance state.

## Nginx limiter

Nginx remains the cheap first line from the production-runtime hardening layer and uses `$binary_remote_addr`, not arbitrary forwarded headers. Its broad API and expensive-transaction flood limits run before Symfony; the Symfony limiter supplies the stable endpoint-aware JSON `429` contract when a request reaches the application.

If another reverse proxy or CDN is introduced, configure its exact addresses at the edge. Do not make `X-Forwarded-For` authoritative merely because the header exists.

## Client IP and trusted proxies

`TRUSTED_PROXIES` is empty by default. With that default, Symfony does not trust client-supplied `X-Forwarded-*` values when resolving the client IP.

Only an operator who actually deploys a reverse proxy/CDN should set `TRUSTED_PROXIES`, and it must contain the exact proxy IPs/CIDRs for that deployment. Do not use `0.0.0.0/0`, `REMOTE_ADDR`, `private_ranges` or another trust-everybody/trust-the-whole-network shortcut unless the network perimeter independently makes that safe and the deployment is deliberately redesigned around it.

`x-forwarded-host` is not trusted by this configuration.

## Provider read cache

The provider read cache is short-lived and scoped by exact chain, network, operation and operation context.

| Read | TTL |
| --- | ---: |
| DOGE/BTC/LTC address balance | 10 seconds |
| DOGE/BTC/LTC UTXO lookup | 10 seconds |
| ETH native balance | 8 seconds |
| ERC-20 balance | 8 seconds |

ERC-20 keys also include the exact token contract, so an ETH balance and a USDT balance cannot collide. DOGE, BTC and LTC keys have separate chain scopes.

Provider exceptions are not cached. Ethereum nonce, gas estimate, fee quote and transaction prepare results are not cached because freshness matters.

## Broadcast deduplication

A confirmed successful broadcast is remembered for 120 seconds. The canonical success marker is scoped by exact `chain + network + txid`.

For DOGE, BTC and LTC the service calculates the UTXO txid locally before provider submission and uses it directly for duplicate lookup.

For Ethereum, the backend does not introduce a second Keccak implementation solely for this feature. It computes a SHA-256 fingerprint of the exact signed raw bytes as a lookup index. Only after `eth_sendRawTransaction` returns a valid transaction hash is that fingerprint linked to the canonical `chain + network + txid` success marker. A repeated request for those exact signed bytes can then return the already confirmed hash without another provider call.

A request attempt, timeout, transport failure, upstream rate limit or other uncertain outcome is never recorded as successfully broadcast. Transactions are never modified or re-signed.

## Provider cooldown

When BlockCypher or Ethereum JSON-RPC returns HTTP `429`, ChainCourier records a 10-second cooldown scoped by provider, chain, network and operation. Requests that would require that same upstream operation fail locally during the cooldown instead of amplifying traffic against the already rate-limited provider.

Cached reads and already-confirmed duplicate broadcasts can still be served without calling the provider. Permanent validation/provider errors do not open the cooldown.

## Telemetry and secret handling

Provider telemetry records provider, operation, chain/network, outcome, HTTP status/duration where available, masked public addresses and public txids. Limiter telemetry records the route/policy, HTTP 429 outcome, retry interval, duration and a one-way short hash of the resolved client IP.

Never log mnemonic/seed phrases, private keys, WIF, raw signed transaction bodies, transaction-prepare request bodies, or credential-bearing Ethereum RPC URLs.

## CAPTCHA and third-party JavaScript

Do not add CAPTCHA to wallet creation, seed recovery or local signing. Those operations intentionally remain browser-local, and ChainCourier does not add third-party JavaScript to the wallet page for abuse protection.

If a browser challenge is ever needed, design it as an edge/API abuse control that cannot observe wallet secrets.

## When Redis becomes justified

Redis is not justified by the current single-instance runtime. Add shared limiter/cache state only when a concrete horizontally scaled deployment has multiple application instances and needs consistent cross-instance rate-limit, cooldown, read-cache or broadcast-dedupe state. At that point the storage-facing services can be pointed at shared pools without moving wallet secrets server-side.
