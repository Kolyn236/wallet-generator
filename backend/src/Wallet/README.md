# Wallet module

Owns wallet identity, public addresses and ownership metadata.

It does not own blockchain provider calls, transaction serialization/signing or secret persistence. Chain-specific behavior is accessed through Application/Domain contracts from the relevant modules.
