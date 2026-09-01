# Signer module

This module is reserved as a backend architecture boundary for any future signing-related contracts or key references.

The current supported runtime has **no server-side signer**. Wallet creation, key derivation and transaction signing happen in the browser, and Symfony must never receive plaintext WIF, private keys or seed phrases.

Do not add server-side signing here as an incremental convenience. Introducing custody or a backend signing service would require a separate architecture and security decision with an explicit key-management boundary.
