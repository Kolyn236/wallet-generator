FROM composer:2.8 AS composer

FROM php:8.4-fpm-alpine

RUN apk add --no-cache libpq-dev \
    && docker-php-ext-install pdo_pgsql opcache

COPY --from=composer /usr/bin/composer /usr/bin/composer

WORKDIR /app/backend
