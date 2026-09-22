FROM node:20-slim

# Enable pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

# Copy all project files
COPY . .

# Bypass pnpm v10 build script blocking
ENV PNPM_CONFIG_ONLY_BUILT_DEPENDENCIES=esbuild,@swc/core,sharp,@expo/ngrok-bin-linux-x64

# Install dependencies allowing build scripts
RUN pnpm install --no-frozen-lockfile --unsafe-perm

# Run the root build script
RUN pnpm run build

ENV PORT=5000
EXPOSE 5000

CMD ["pnpm", "start"]