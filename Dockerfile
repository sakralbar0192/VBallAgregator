FROM oven/bun:latest

WORKDIR /app

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

COPY . .

RUN bun run prisma:generate

EXPOSE 3000

CMD ["bun", "run", "index.ts"]