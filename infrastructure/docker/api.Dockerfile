FROM node:20-alpine

WORKDIR /workspace

RUN apk add --no-cache git

RUN corepack enable && corepack prepare pnpm@10.11.1 --activate

CMD ["sh", "-c", "pnpm config set store-dir /pnpm/store && pnpm install --frozen-lockfile --force && rm -rf /workspace/apps/api/dist /workspace/apps/api/tsconfig.tsbuildinfo && pnpm --filter api prisma:generate && pnpm --filter api prisma:migrate:deploy && pnpm --filter api dev"]
