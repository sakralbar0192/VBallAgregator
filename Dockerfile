# 1) Сборочный слой на glibc
FROM node:20-bookworm-slim AS builder
WORKDIR /app

# Полезные системные пакеты
RUN apt-get update && apt-get install -y --no-install-recommends \
  python3 make g++ ca-certificates curl git \
  && rm -rf /var/lib/apt/lists/*

# 2) Переменные, отключающие «проблемные» шаги на этапе install
# - msgpackr-extract не будет собирать нативный аддон
# - Prisma не будет триггерить postinstall (скачивание движков)
ENV MSGPACKR_EXTRACT_SKIP_NATIVE=1 \
    PRISMA_SKIP_POSTINSTALL_GENERATE=1 \
    npm_config_loglevel=notice

# 3) Установка зависимостей (без запуска скриптов других пакетов)
COPY package.json package-lock.json* pnpm-lock.yaml* yarn.lock* ./
# Выберите один менеджер; пример для npm:
RUN npm ci --ignore-scripts

# 4) Дальше — исходники проекта
COPY . .

# Заглушка для генерации Prisma Client (меняйте на свой тип БД)
# Для Postgres:
ARG DATABASE_URL="postgresql://user:pass@localhost:5432/db?schema=public"
ENV DATABASE_URL=$DATABASE_URL

# 5) Явно генерируем Prisma уже после установки (тут можно настроить прокси/зеркало)
# Если у вас есть проблемы с доступом к CDN Prisma —
# используйте PRISMA_ENGINES_MIRROR, указывая собственное зеркало/S3.
# ENV PRISMA_ENGINES_MIRROR=https://my-cdn.example.com/prisma
RUN npx prisma generate

# 6) Сборка TS
RUN npm run build

# 7) Рантайм слой
FROM node:20-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY package.json ./

CMD ["node", "dist/index.js"]
