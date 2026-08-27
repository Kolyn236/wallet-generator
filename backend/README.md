# Symfony backend

This directory is the new Symfony 7.4 LTS / PHP 8.4 backend introduced alongside the existing Python Dogecoin reference implementation.

The migration is intentionally incremental. Do not remove or bypass the Python wallet code until feature parity is covered by tests and the migration plan explicitly retires it.

## Local Docker environment

From the repository root:

```bash
docker compose up --build
```

The PHP container runs `composer install` before starting PHP-FPM.

Services:

- API through Nginx: `http://localhost:8080`;
- health endpoint: `http://localhost:8080/api/health`;
- PostgreSQL: `localhost:5432`;
- Redis: `localhost:6379`;
- RabbitMQ AMQP: `localhost:5672`;
- RabbitMQ management UI: `http://localhost:15672` (`guest` / `guest`, local development only).

## Local PHP commands

```bash
cd backend
cp .env.example .env.local
composer install
composer test
composer analyse
composer cs:check
```

The bootstrap intentionally does not use PostgreSQL, Redis or RabbitMQ yet. Their services are present so the next focused infrastructure changes can wire Doctrine, Cache/Lock and Messenger without changing the development topology again.

## Existing Python reference

From the repository root the existing check remains:

```bash
python3 doge_wallet.py --self-test
```
