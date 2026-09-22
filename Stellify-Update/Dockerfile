FROM php:8.2-apache

# Install PostgreSQL extensions for PHP
RUN apt-get update && apt-get install -y libpq-dev \
    && docker-php-ext-install pdo pdo_pgsql pgsql

# Copy application contents directly into Apache web root
COPY . /var/www/html/

# Fix permissions so Apache (www-data) can read all files
RUN chown -R www-data:www-data /var/www/html \
    && chmod -R 755 /var/www/html

# Enable Apache rewrite module
RUN a2enmod rewrite

# Tell Apache to look inside /var/www/html/Stellify-Update if files are nested
DOCUMENTROOT /var/www/html
RUN sed -i 's|/var/www/html|/var/www/html/Stellify-Update|g' /etc/apache2/sites-available/000-default.conf

EXPOSE 80