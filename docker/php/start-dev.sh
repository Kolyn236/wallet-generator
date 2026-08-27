#!/bin/sh
set -eu

composer install --no-interaction --prefer-dist

mkdir -p var/cache var/log
chown -R www-data:www-data var

exec php-fpm
