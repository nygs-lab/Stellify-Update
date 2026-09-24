FROM node:20-slim

# Install pnpm v9
RUN npm install -g pnpm@9

WORKDIR /app

# Copy repository files
COPY . .

# Set environment variables required for build phase
ENV PORT=5000
ENV BASE_PATH=/
ENV EXPO_PUBLIC_DOMAIN=stellify-update.onrender.com

# Install dependencies
RUN pnpm install --no-frozen-lockfile

# Build workspace projects
RUN pnpm -r --filter "./artifacts/**" --if-present run build

EXPOSE 5000

# Push Drizzle schema explicitly, seed database, then spin up the API server
CMD ["sh", "-c", "npx drizzle-kit push --schema=./lib/db/src/schema.ts || npx drizzle-kit push || true; npx tsx scripts/src/seed-pmdb.ts || pnpm --filter @workspace/scripts start || true; pnpm --filter @workspace/api-server start"]