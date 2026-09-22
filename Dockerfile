FROM node:20-slim

# Install pnpm globally
RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

# Copy package management files
COPY package.json pnpm-lock.yaml* ./

# Allow native build scripts (esbuild, etc.) and install dependencies
RUN pnpm config set ignore-scripts false
RUN pnpm install --unsafe-perm

# Copy remaining source code
COPY . .

# Build application with script execution allowed
RUN pnpm run build --if-present

ENV PORT=5000
EXPOSE 5000

# Start application
CMD ["pnpm", "start"]