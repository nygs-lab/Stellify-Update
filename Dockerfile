FROM node:20-slim

# Install pnpm v9
RUN npm install -g pnpm@9

WORKDIR /app

# Copy all files
COPY . .

# Build environment variables
ENV PORT=5000
ENV BASE_PATH=/
ENV EXPO_PUBLIC_DOMAIN=stellify-update.onrender.com

# Install dependencies
RUN pnpm install --no-frozen-lockfile

# Build workspace apps
RUN pnpm -r --filter "./artifacts/**" --if-present run build

EXPOSE 5000

# Push Drizzle schema directly via drizzle-kit before starting the API server
CMD ["sh", "-c", "npx drizzle-kit push || true; pnpm --filter @workspace/api-server start"]