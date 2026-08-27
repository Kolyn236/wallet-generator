# Prompt 006 — React migration and production hardening

Task: after Symfony APIs are stable, migrate the browser UI to React + TypeScript + Vite and prepare the system for production validation.

UI requirements:

- keep RU/EN localization;
- wallet list and balances;
- create wallet flow according to the approved signing/key model;
- send flow with human-readable review;
- explicit irreversible broadcast action;
- transaction status/confirmations;
- never store secrets in localStorage/sessionStorage.

Production-readiness work:

- Nginx/PHP-FPM settings;
- multiple Messenger workers;
- rate limiting;
- structured logs;
- metrics and tracing;
- health/readiness endpoints;
- database backups and restore runbook;
- RabbitMQ/Redis failure behavior;
- k6 scenarios for 300 RPS read traffic plus realistic write traffic;
- security review before real funds.

Do not claim production readiness merely because a load test passes.

Suggested commits should separate UI migration, observability, load testing and deployment hardening.