#!/bin/sh
set -eu

fail() {
    echo "Production runtime configuration error: $1" >&2
    exit 1
}

[ "${APP_ENV:-}" = "prod" ] || fail "APP_ENV must be prod"
[ "${APP_DEBUG:-}" = "0" ] || fail "APP_DEBUG must be 0"

secret="${APP_SECRET:-}"
[ -n "$secret" ] || fail "APP_SECRET is required"

case "$secret" in
    change-me|change-me-for-local-development|local-development-only-change-me|test-secret)
        fail "APP_SECRET must not use a development/test placeholder"
        ;;
esac

[ "${#secret}" -ge 32 ] || fail "APP_SECRET must be at least 32 characters"

exec "$@"
