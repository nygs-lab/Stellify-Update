FROM php:8.2-apache

# Install PostgreSQL extensions for PHP
RUN apt-get update && apt-get install -y libpq-dev \
    && docker-php-ext-install pdo pdo_pgsql pgsql

# Copy application files specifically from the Stellify-Update folder into Apache root
COPY Stellify-Update/ /var/www/html/

# Enable Apache rewrite module
RUN a2enmod rewrite

# Tell Apache where to look for directory index files
RUN echo "DirectoryIndex index.php index.html" >> /etc/apache2/apache2.conf

EXPOSE 80