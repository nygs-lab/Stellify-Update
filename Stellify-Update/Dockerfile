FROM php:8.2-apache

# Install PostgreSQL client drivers
RUN apt-get update && apt-get install -y libpq-dev \
    && docker-php-ext-install pdo pdo_pgsql pgsql

# Copy application files into Apache web root
COPY . /var/www/html/

# Enable Apache rewrite engine
RUN a2enmod rewrite

EXPOSE 80