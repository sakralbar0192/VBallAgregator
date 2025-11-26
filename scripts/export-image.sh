#!/bin/bash
set -euo pipefail

# Скрипт экспорта Docker образа приложения в tar архив
# Выполняйте в корне проекта после успешной сборки

IMAGE_NAME="vball-app-prod"
IMAGE_TAG="latest"
ARCHIVE_NAME="${IMAGE_NAME}.tar"

echo "🚀 Экспорт образа ${IMAGE_NAME}:${IMAGE_TAG}..."

# Сборка образа (использует оптимизированный Dockerfile)
docker build \
  --no-cache=false \
  --platform=linux/amd64 \
  -t "${IMAGE_NAME}:${IMAGE_TAG}" \
  .

# Сохранение в tar архив
docker save "${IMAGE_NAME}:${IMAGE_TAG}" -o "${ARCHIVE_NAME}"

# Проверка размера
ARCHIVE_SIZE=$(du -h "${ARCHIVE_NAME}" | cut -f1)
echo "✅ Образ успешно экспортирован в ${ARCHIVE_NAME} (${ARCHIVE_SIZE})"

echo "📋 Следующие шаги:"
echo "1. Загрузите ${ARCHIVE_NAME} на VPS (scp или rsync)"
echo "2. На VPS: ./scripts/import-image.sh"