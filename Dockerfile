FROM node:20-slim

# Enable pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

# Copy all repository files
COPY . .

# Install all dependencies ignoring frozen lockfile check for scripts
RUN pnpm install --no-frozen-lockfile

# Run the root build script
RUN pnpm run build

ENV PORT=5000
EXPOSE 5000

CMD ["pnpm", "start"]