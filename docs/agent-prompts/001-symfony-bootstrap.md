# Prompt 001 — Bootstrap Symfony without breaking Python

You are modifying `Kolyn236/doge-wallet-generator`.

Read `AGENTS.md`, `docs/architecture/ADR-001-modular-monolith.md` and `docs/architecture/MIGRATION_PLAN.md` before changing code.

Task: introduce the first Symfony backend skeleton alongside the current Python implementation.

Requirements:

1. Create `backend/` using PHP 8.4 and Symfony 7.4 LTS.
2. Do not delete, rename or behaviorally modify existing Python wallet files.
3. Add a minimal JSON `GET /api/health` endpoint.
4. Add PHPUnit and static analysis suitable for CI.
5. Add Docker development services for Nginx, PHP-FPM, PostgreSQL, Redis and RabbitMQ.
6. Use environment variables for connection strings; commit only safe development defaults/examples.
7. Do not add wallet entities, transaction logic or blockchain logic yet.
8. Do not persist or introduce private-key handling in Symfony in this commit.
9. Document exact local start/test commands.
10. Keep the commit focused on bootstrap/infrastructure only.

Acceptance criteria:

- Symfony boots;
- health endpoint responds;
- tests run;
- current Python self-tests remain runnable;
- no existing DOGE workflow is removed.

Suggested commit: `build(symfony): bootstrap modular monolith backend`.