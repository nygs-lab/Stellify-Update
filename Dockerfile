FROM node:20-slim

RUN npm install -g pnpm@9

WORKDIR /app

COPY . .

ENV PORT=5000
ENV BASE_PATH=/
ENV EXPO_PUBLIC_DOMAIN=stellify-update.onrender.com

RUN pnpm install --no-frozen-lockfile

# Build workspace projects
RUN pnpm -r --filter "./artifacts/**" --if-present run build

EXPOSE 5000

# Push database schema to Neon before starting the server
CMD ["sh", "-c", "pnpm --filter @workspace/db db:push || pnpm db:push; pnpm --filter @workspace/api-server start"]