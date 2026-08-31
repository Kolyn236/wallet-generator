FROM composer:2.8 AS composer

FROM php:8.4-fpm-alpine

RUN apk add --no-cache gmp-dev \
    && docker-php-ext-install gmp opcache

COPY --from=composer /usr/bin/composer /usr/bin/composer

WORKDIR /app/backend
