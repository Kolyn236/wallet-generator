# Prompt 004 — Introduce Dogecoin as the first chain adapter

Read the architecture docs and inspect the existing Python implementation before coding.

Task: implement Dogecoin behind chain-neutral ports without coupling the application layer to BlockCypher or Dogecoin-specific HTTP details.

Order of work:

1. public address/value objects and Dogecoin network parameters;
2. provider port for balance/UTXO lookup;
3. BlockCypher adapter as one infrastructure implementation;
4. Dogecoin application query for balance/UTXOs;
5. deterministic tests using fixtures;
6. only then plan transaction construction/signing migration.

Requirements:

- application code depends on ports, not BlockCypher;
- monetary values are integers in smallest units, never float;
- external calls have timeouts and typed failure mapping;
- provider responses are validated;
- Python remains a reference and is not deleted;
- do not copy custom crypto into production PHP blindly;
- document which crypto/signing primitives will use audited/trusted libraries before implementing the signing path.

Suggested commit: `feat(dogecoin): add chain adapter and balance provider`.