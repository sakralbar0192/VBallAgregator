#!/bin/bash
set -euo pipefail

# Скрипт импорта Docker образа на VPS
# Использование: ./scripts/import-image.sh [archive.tar]
# По умолчанию: vball-app-prod.tar

ARCHIVE_NAME="${1:-vball-app-prod.tar}"
IMAGE_NAME="vball-app-prod:latest"

if [ ! -f "$ARCHIVE_NAME" ]; then
  echo "❌ Архив '$ARCHIVE_NAME' не найден в текущей директории"
  echo "📋 Скачайте архив с локальной машины и повторите"
  exit 1
fi

echo "📥 Импорт образа из $ARCHIVE_NAME..."

# Загрузка образа
docker load -i "$ARCHIVE_NAME"

echo "✅ Образ '$IMAGE_NAME' успешно импортирован"

# Проверка
echo "📋 Доступные образы:"
docker images | grep vball-app-prod || true

echo ""
echo "🚀 Следующие шаги для запуска:"
echo "1. docker-compose -f docker-compose.prod.yml pull db redis nginx  # (опционально обновить)"
echo "2. docker-compose -f docker-compose.prod.yml up -d"
echo "3. docker-compose -f docker-compose.prod.yml logs -f app"
echo ""
echo "⚠️  Убедитесь, что docker-compose.prod.yml использует image: vball-app-prod:latest"