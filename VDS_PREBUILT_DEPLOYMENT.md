# 🚀 Развертывание VBallAgregator с предсобранным Docker образом

## 🎯 Решение проблемы с Prisma engines

**Проблема:** Dockerfile скачивает Prisma engines (query-engine) из GitHub во время `docker build` на VPS. В России это блокируется гео-ограничениями.

**Решение (5 шагов):**
1. **Оптимизированная сборка локально** (где скачивание работает)
2. **Экспорт образа** в `.tar` архив
3. **Перенос архива** на VPS (`scp`)
4. **Импорт образа** на VPS
5. **Запуск** через `docker-compose.prod.yml` (без `build`)

## 📋 Пошаговая инструкция

### Шаг 1: Локальная сборка и экспорт образа
```bash
# В корне проекта (локальная машина)
git pull origin main
./scripts/export-image.sh
```
- Создает `vball-app-prod.tar` (~500-800 МБ)
- Использует оптимизированный [`Dockerfile`](Dockerfile) с кэшированием Prisma engines

### Шаг 2: Перенос архива на VPS
```bash
# Замените YOUR_VPS_IP на IP вашего сервера
scp vball-app-prod.tar root@YOUR_VPS_IP:/opt/vball-aggregator/
```

### Шаг 3: Импорт и запуск на VPS
```bash
# Подключитесь к VPS
ssh root@YOUR_VPS_IP

# Перейдите в директорию проекта
cd /opt/vball-aggregator/VBallAgregator  # или где клонирован проект

# Импорт образа
./scripts/import-image.sh vball-app-prod.tar

# Запуск (использует image: vball-app-prod:latest из обновленного docker-compose.prod.yml)
docker compose -f docker-compose.prod.yml up -d

# Проверка
docker compose -f docker-compose.prod.yml ps
docker compose -f docker-compose.prod.yml logs -f app
```

### Шаг 4: Миграции БД (при необходимости)
```bash
docker compose -f docker-compose.prod.yml exec app npm run prisma:deploy
```

## ⚡ Преимущества нового подхода
- ✅ **Обход блокировок** — сборка только локально
- ✅ **Быстрый деплой** — на VPS только `docker load` + `up` (~1-2 мин)
- ✅ **Кэширование** — Prisma engines скачиваются 1 раз локально
- ✅ **Стабильность** — нет зависимости от сетевых ограничений на проде
- ✅ **Простота** — готовые скрипты `export-image.sh` / `import-image.sh`

## 🔄 Обновление приложения
1. Локально: `git pull && ./scripts/export-image.sh`
2. Перенос нового `.tar`
3. На VPS: `./scripts/import-image.sh new-image.tar && docker compose up -d --force-recreate app`

## ❗ Важные замечания
- Обновленный [`docker-compose.prod.yml`](docker-compose.prod.yml) использует `image` вместо `build`
- Архив содержит только app образ (db/redis/nginx pull'ятся автоматически)
- Размер архива: ~500-800 МБ (node_modules + dist + prisma)
- VPS должен иметь Docker Compose v2+

## 📚 Дополнительно
- [Полное руководство по VDS](VDS_DEPLOYMENT_GUIDE.md)
- [Быстрый старт](QUICK_START_VDS.md)

---
*Обновлено: 2025-11-26*