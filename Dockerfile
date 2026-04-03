FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

WORKDIR /app

# Copy workspace config
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/api/package.json ./apps/api/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source code
COPY packages/shared/ ./packages/shared/
COPY apps/api/ ./apps/api/
COPY tsconfig.base.json ./

# Start API with tsx (dev-like, works with workspace TS sources)
WORKDIR /app/apps/api
EXPOSE 3001

CMD ["npx", "tsx", "src/index.ts"]
