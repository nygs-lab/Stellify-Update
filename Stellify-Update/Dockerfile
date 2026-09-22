FROM php:8.2-apache

# Install PostgreSQL extensions for PHP
RUN apt-get update && apt-get install -y libpq-dev \
    && docker-php-ext-install pdo pdo_pgsql pgsql

# Copy application files into Apache root
COPY . /var/www/html/

# Grant www-data ownership and read permissions
RUN chown -R www-data:www-data /var/www/html \
    && chmod -R 755 /var/www/html

# Allow Apache to serve directory indexes and rewrite URLs
RUN a2enmod rewrite

EXPOSE 80