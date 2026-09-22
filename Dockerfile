FROM node:20-slim

# Enable pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

# Copy all project files
COPY . .

# Install dependencies (will now respect package.json pnpm.onlyBuiltDependencies)
RUN pnpm install --no-frozen-lockfile

# Run build script
RUN pnpm run build

ENV PORT=5000
EXPOSE 5000

CMD ["pnpm", "start"]