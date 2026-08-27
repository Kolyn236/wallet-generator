# Indexer module

Owns blockchain synchronization, spendable chain state and confirmation tracking.

It is responsible for moving blockchain reads away from request-time third-party API calls. It communicates state changes through Application contracts/events rather than writing another module's persistence implementation directly.
