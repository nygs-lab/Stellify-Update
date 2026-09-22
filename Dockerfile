FROM node:20-slim

# Force pnpm v9 to bypass pnpm v10 strict lockfile build-script blocks
RUN npm install -g pnpm@9

WORKDIR /app

# Copy repository files
COPY . .

# Install dependencies without pnpm v10 restrictions
RUN pnpm install --no-frozen-lockfile

# Run build script
RUN pnpm run build

ENV PORT=5000
EXPOSE 5000

CMD ["pnpm", "start"]