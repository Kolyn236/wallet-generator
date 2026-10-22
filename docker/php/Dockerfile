FROM composer:2.8 AS composer

FROM php:8.4.27-fpm-alpine

RUN docker-php-ext-install opcache

COPY --from=composer /usr/bin/composer /usr/bin/composer

WORKDIR /app/backend
