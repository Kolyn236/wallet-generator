# Signer module

Owns the signing boundary and key references.

Production persistence must never contain plaintext WIF, private keys or seed phrases. The existing Python cryptography remains a reference implementation until the production signing design is explicitly approved.
