FROM node:20-slim

# Install pnpm v9
RUN npm install -g pnpm@9

WORKDIR /app

# Copy all files
COPY . .

# Install dependencies
RUN pnpm install --no-frozen-lockfile

# Set environment variable required by mobile build script
ENV EXPO_PUBLIC_DOMAIN=stellify-update.onrender.com

# Build workspace apps
RUN pnpm -r --filter "./artifacts/**" --if-present run build

ENV PORT=5000
EXPOSE 5000

CMD ["pnpm", "start"]