#!/bin/sh
set -eu

cd /app/backend

# The image is immutable, but Symfony's runtime cache is release-specific.
# Never carry a previous container's cache into the new release.
rm -rf var/cache/*
mkdir -p var/cache var/log

php bin/console cache:warmup --env=prod --no-debug
chown -R www-data:www-data var

exec php-fpm -F
