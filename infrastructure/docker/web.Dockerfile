FROM node:20-alpine

WORKDIR /workspace

RUN corepack enable && corepack prepare pnpm@10.11.1 --activate

CMD ["sh", "-c", "pnpm config set store-dir /pnpm/store && pnpm install --frozen-lockfile && pnpm --filter web dev --hostname 0.0.0.0 --port ${WEB_PORT:-3000}"]
