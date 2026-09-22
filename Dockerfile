FROM node:20-slim

# Enable pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

# Copy all repository files
COPY . .

# Explicitly configure pnpm to allow all build scripts globally inside Docker
RUN pnpm config set ignore-scripts false

# Install dependencies with explicit script execution enabled
RUN pnpm install --no-frozen-lockfile --config.ignore-scripts=false

# Run build script
RUN pnpm run build

ENV PORT=5000
EXPOSE 5000

CMD ["pnpm", "start"]