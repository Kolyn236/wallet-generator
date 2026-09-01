# Asset module

Owns chain, network and asset definitions used by backend domain/application behavior.

A wallet is not the same thing as an asset. Native assets and token assets may share a chain/network identity, so asset modeling must not assume one blockchain per displayed currency.

Asset code must remain free of wallet-specific persistence and provider-specific HTTP behavior. Add concrete asset/token concepts only when backend behavior requires them.
