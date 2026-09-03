FROM composer:2.8 AS composer

FROM php:8.4-fpm-alpine AS php-base

RUN docker-php-ext-install opcache

COPY --from=composer /usr/bin/composer /usr/bin/composer

WORKDIR /app/backend

FROM php-base AS production

ENV APP_ENV=prod \
    APP_DEBUG=0

COPY backend/ /app/backend/
RUN composer install --no-dev --no-interaction --prefer-dist --classmap-authoritative --no-scripts \
    && mkdir -p var/cache var/log \
    && chown -R www-data:www-data var

COPY docker/php/opcache-prod.ini /usr/local/etc/php/conf.d/zz-opcache-prod.ini
COPY docker/php/start-prod.sh /usr/local/bin/start-prod
RUN chmod 0755 /usr/local/bin/start-prod

ENTRYPOINT ["/usr/local/bin/start-prod"]
CMD ["php-fpm"]

FROM php-base AS development
