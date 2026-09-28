FROM node:20-slim

# Disable interactive prompts during npm/pnpm operations
ENV CI=true

# Install pnpm v9 globally
RUN npm install -g pnpm@9

WORKDIR /app

# Copy repository files
COPY . .

# Set environment variables required for build phase
ENV PORT=5000
ENV BASE_PATH=/
ENV EXPO_PUBLIC_DOMAIN=stellify-update.onrender.com

# Install dependencies non-interactively
RUN pnpm install --no-frozen-lockfile

# Build workspace projects
RUN pnpm -r --filter "./artifacts/**" --if-present run build

EXPOSE 5000

# Start API server directly
CMD ["pnpm", "--filter", "@workspace/api-server", "start"]