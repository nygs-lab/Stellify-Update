FROM node:20-slim

# Enable pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

# Copy all files
COPY . .

# 1. Run approve-builds with --g (global) or auto-accept to allow esbuild
RUN pnpm approve-builds --all || true

# 2. Install dependencies with build scripts explicitly allowed
RUN pnpm install --no-frozen-lockfile --config.onlyBuiltDependencies=""

# 3. Build application
RUN pnpm run build

ENV PORT=5000
EXPOSE 5000

CMD ["pnpm", "start"]