FROM node:20-slim

# Install pnpm globally
RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

# Copy package management files
COPY package.json pnpm-lock.yaml* ./

# Install dependencies
RUN pnpm install

# Copy source code
COPY . .

# Build application if build script exists
RUN pnpm run build --if-present

ENV PORT=5000
EXPOSE 5000

# Start application
CMD ["pnpm", "start"]