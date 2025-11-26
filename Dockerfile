# syntax=docker/dockerfile:1
# 1) Базовый слой: установка зависимостей и генерация Prisma Client
FROM node:20-bookworm-slim AS base

WORKDIR /app

# Полезные системные пакеты
RUN apt-get update && apt-get install -y --no-install-recommends \
  python3 make g++ ca-certificates curl git openssl \
  && rm -rf /var/lib/apt/lists/*

# Переменные, отключающие «проблемные» шаги
ENV MSGPACKR_EXTRACT_SKIP_NATIVE=1 \
    PRISMA_SKIP_POSTINSTALL_GENERATE=1 \
    npm_config_loglevel=notice

# 2) Установка зависимостей (без запуска скриптов)
COPY package.json package-lock.json* ./
RUN npm ci --ignore-scripts

# 3) Генерация Prisma Client (кешируется отдельно)
COPY prisma ./prisma

# Заглушка для генерации Prisma Client
ARG DATABASE_URL="file:./dev.db"
ENV DATABASE_URL=$DATABASE_URL

# Генерация Prisma Client
RUN npx prisma generate

# Pre-download Prisma CLI engines (migration-engine, etc.) for offline use
RUN npx prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script > /dev/null || true

# 4) Сборка приложения
COPY . .
RUN npm run build

# 5) Рантайм слой
FROM node:20-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production

RUN apt-get update && apt-get install -y --no-install-recommends \
    openssl \
    && rm -rf /var/lib/apt/lists/*

COPY --from=base /app/node_modules ./node_modules
COPY --from=base /root/.cache/prisma /root/.cache/prisma
COPY --from=base /app/dist ./dist
COPY --from=base /app/prisma ./prisma
COPY package.json ./

EXPOSE 3000

CMD ["node", "dist/index.js"]
