# User-controlled publication and migration

[Project overview](../README.md)

The former Symfony `/transactions/broadcast` endpoints are removed for all chains. Integrations must publish signed payloads directly to their own node/provider; there is no automatic backend forwarding or compatibility relay.

After local signing/review, choose a browser-accessible endpoint and explicitly submit, or export the signed payload for external broadcast. The UI retains the identical signed bytes after a transport error for deliberate retry, without changing nonce, inputs, fees or TRON expiry. CORS, authentication and provider rate limits can prevent a direct browser request; use export rather than forwarding through the default backend. No secret provider key is built into the frontend. No relay is required or included.

Backend RPC settings configure public reads/preparation only; they are not automatically exposed as browser broadcast destinations. Inspect the selected provider's privacy and authentication policy. Provider acceptance is not proof of confirmation or successful contract execution.

See the [security model](SECURITY_MODEL.md) for trust boundaries, compromised-hosted-JavaScript risks, browser-memory limitations and self-hosting/release guidance. `compose.yaml` is a development stack, not a production-hardening recipe.

