FROM node:20-slim

# Install pnpm globally
RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

# Copy package management files first
COPY package.json pnpm-lock.yaml* ./

# Install dependencies
RUN pnpm install --frozen-lockfile || pnpm install

# Copy application source code
COPY . .

# Build step (if your package.json has a build script)
RUN pnpm run build --if-present

EXPOSE 5000

# Start the application
CMD ["pnpm", "start"]