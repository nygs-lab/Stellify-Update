FROM php:8.2-apache

# Install PostgreSQL extensions for PHP
RUN apt-get update && apt-get install -y libpq-dev \
    && docker-php-ext-install pdo pdo_pgsql pgsql

# Copy application files from the subfolder into Apache root
COPY Stellify-Update/ /var/www/html/

# Fix ownership and permissions
RUN chown -R www-data:www-data /var/www/html \
    && chmod -R 755 /var/www/html

# Enable Apache rewrite module
RUN a2enmod rewrite

EXPOSE 80