#!/bin/bash

# =============================================================================
# Автоматизированный скрипт развертывания VBallAgregator на VDS
# =============================================================================

set -e  # Остановить выполнение при ошибке

# Цвета для вывода
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Функция логирования
log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}"
}

error() {
    echo -e "${RED}[ERROR] $1${NC}"
}

warning() {
    echo -e "${YELLOW}[WARNING] $1${NC}"
}

info() {
    echo -e "${BLUE}[INFO] $1${NC}"
}

# Проверка запуска от root
if [[ $EUID -ne 0 ]]; then
   error "Этот скрипт должен быть запущен от имени root"
   exit 1
fi

# =============================================================================
# ШАГ 1: Обновление системы и установка базовых пакетов
# =============================================================================
log "Начинаю установку VBallAgregator на VDS..."

log "Обновление списка пакетов..."
apt update

log "Обновление системы..."
apt upgrade -y

log "Установка базовых пакетов..."
apt install -y curl wget git unzip software-properties-common apt-transport-https ca-certificates gnupg lsb-release net-tools

# =============================================================================
# ШАГ 2: Установка Docker
# =============================================================================
log "Установка Docker..."

# Добавление официального GPG ключа Docker
if [ ! -f /usr/share/keyrings/docker-archive-keyring.gpg ]; then
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg
fi

# Добавление репозитория Docker
echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null

# Обновление и установка Docker
apt update
apt install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin

# Запуск и включение Docker
systemctl enable docker
systemctl start docker

# Проверка установки Docker
log "Проверка установки Docker..."
docker --version
docker compose version

# Тест Docker
docker run hello-world

# =============================================================================
# ШАГ 3: Создание структуры проекта
# =============================================================================
log "Создание структуры проекта..."

# Создание директории приложения
APP_DIR="/opt/vball-aggregator"
mkdir -p $APP_DIR/{data/postgres,data/redis,logs,backups,certs}

# Переход в директорию приложения
cd $APP_DIR

log "Структура проекта создана в $APP_DIR"

# =============================================================================
# ШАГ 4: Инструкции для пользователя
# =============================================================================
log ""
log "============================================================================="
log "БАЗОВАЯ УСТАНОВКА ЗАВЕРШЕНА!"
log "============================================================================="
log ""
log "Далее вам нужно:"
log ""
log "1. СКОПИРОВАТЬ ФАЙЛЫ ПРОЕКТА на сервер:"
log "   - Используйте git clone или scp для копирования проекта"
log "   - Поместите файлы в директорию $APP_DIR"
log ""
log "2. НАСТРОИТЬ ПЕРЕМЕННЫЕ ОКРУЖЕНИЯ:"
log "   - Скопируйте .env.prod файл"
log "   - Отредактируйте его с вашими настройками"
log "   - Установите правильные пароли"
log ""
log "3. ЗАПУСТИТЬ ПРИЛОЖЕНИЕ:"
log "   docker compose -f docker-compose.prod.yml --env-file .env.prod up -d"
log ""
log "4. ВЫПОЛНИТЬ МИГРАЦИИ:"
log "   docker compose -f docker-compose.prod.yml exec app npm run prisma:migrate"
log ""
log "============================================================================="
log ""
log "Для продолжения развертывания используйте файл VDS_DEPLOYMENT_GUIDE.md"
log ""

# =============================================================================
# Создание systemd сервиса для автозапуска
# =============================================================================
log "Создание systemd сервиса..."

cat > /etc/systemd/system/vball-aggregator.service << 'EOF'
[Unit]
Description=VBallAgregator Docker Compose application
Requires=docker.service
After=docker.service

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=/opt/vball-aggregator
ExecStart=/usr/bin/docker compose -f docker-compose.prod.yml --env-file .env.prod up -d
ExecStop=/usr/bin/docker compose -f docker-compose.prod.yml down
TimeoutStartSec=0

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload

# =============================================================================
# Создание скриптов управления
# =============================================================================
log "Создание скриптов управления..."

# Скрипт запуска
cat > $APP_DIR/start.sh << 'EOF'
#!/bin/bash
cd /opt/vball-aggregator
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d
echo "Приложение запущено"
EOF

# Скрипт остановки
cat > $APP_DIR/stop.sh << 'EOF'
#!/bin/bash
cd /opt/vball-aggregator
docker compose -f docker-compose.prod.yml down
echo "Приложение остановлено"
EOF

# Скрипт перезапуска
cat > $APP_DIR/restart.sh << 'EOF'
#!/bin/bash
cd /opt/vball-aggregator
docker compose -f docker-compose.prod.yml down
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d
echo "Приложение перезапущено"
EOF

# Скрипт просмотра логов
cat > $APP_DIR/logs.sh << 'EOF'
#!/bin/bash
cd /opt/vball-aggregator
docker compose -f docker-compose.prod.yml logs -f
EOF

# Скрипт статуса
cat > $APP_DIR/status.sh << 'EOF'
#!/bin/bash
cd /opt/vball-aggregator
docker compose -f docker-compose.prod.yml ps
EOF

# Скрипт backup БД
cat > $APP_DIR/backup.sh << 'EOF'
#!/bin/bash
cd /opt/vball-aggregator
BACKUP_FILE="backup_$(date +%Y%m%d_%H%M%S).sql"
docker compose -f docker-compose.prod.yml exec -T db pg_dump -U vball_app vball_prod > backups/$BACKUP_FILE
echo "Backup создан: $BACKUP_FILE"
EOF

# Скрипт обновления
cat > $APP_DIR/update.sh << 'EOF'
#!/bin/bash
cd /opt/vball-aggregator
echo "Остановка приложения..."
docker compose -f docker-compose.prod.yml down

echo "Обновление кода..."
git pull

echo "Пересборка образов..."
docker compose -f docker-compose.prod.yml build --no-cache

echo "Запуск приложения..."
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d

echo "Выполнение миграций..."
docker compose -f docker-compose.prod.yml exec app npm run prisma:migrate

echo "Обновление завершено"
EOF

# Установка прав на выполнение
chmod +x $APP_DIR/*.sh

# =============================================================================
# Создание базового .env.prod файла
# =============================================================================
log "Создание базового .env.prod файла..."

cat > $APP_DIR/.env.prod << 'EOF'
# ============================================================================
# VBallAgregator Production Environment Configuration
# ============================================================================

# ============================================================================
# 1. ENVIRONMENT
# ============================================================================
NODE_ENV=production
LOG_LEVEL=info

# ============================================================================
# 2. DATABASE CONFIGURATION
# ============================================================================
# ВАЖНО: Измените пароль на безопасный!
DATABASE_URL="postgresql://vball_app:CHANGE_ME_PASSWORD@db:5432/vball_prod"

# ============================================================================
# 3. REDIS CONFIGURATION  
# ============================================================================
REDIS_HOST=redis
REDIS_PORT=6379
REDIS_PASSWORD=CHANGE_ME_REDIS_PASSWORD
REDIS_DB=0
REDIS_TLS=false

# ============================================================================
# 4. TELEGRAM BOT CONFIGURATION (REQUIRED)
# ============================================================================
# Получите токен от @BotFather в Telegram
TELEGRAM_BOT_TOKEN=YOUR_BOT_TOKEN_HERE

# Секретный токен для вебхуков (генерируется автоматически)
TELEGRAM_WEBHOOK_SECRET=$(openssl rand -base64 32)

# ============================================================================
# 5. API CONFIGURATION
# ============================================================================
API_HOST=0.0.0.0
API_PORT=3000
API_BASE_URL=http://45.143.95.171:3000

# ============================================================================
# 6. SECURITY CONFIGURATION
# ============================================================================
# JWT Secret (генерируется автоматически)
JWT_SECRET=$(openssl rand -base64 32)

# ============================================================================
# 7. LOCALIZATION
# ============================================================================
DEFAULT_TIMEZONE=Asia/Irkutsk
DEFAULT_LOCALE=ru-RU

# ============================================================================
# 8. LOGGING CONFIGURATION
# ============================================================================
LOG_FORMAT=json
LOG_OUTPUT=file
LOG_FILE_PATH=/opt/vball-aggregator/logs/app.log
LOG_FILE_MAX_SIZE=10m
LOG_FILE_MAX_FILES=10

# ============================================================================
# 9. FEATURE FLAGS
# ============================================================================
FEATURE_PAYMENTS_ENABLED=true
FEATURE_NOTIFICATIONS_ENABLED=true
FEATURE_SCHEDULING_ENABLED=true
FEATURE_ANALYTICS_ENABLED=true
EOF

# Установка прав доступа
chmod 600 $APP_DIR/.env.prod

# =============================================================================
# Создание файла с информацией о системе
# =============================================================================
log "Создание системной информации..."

cat > $APP_DIR/system-info.txt << EOF
VBallAgregator System Information
=================================

Server: $(hostname)
Date: $(date)
OS: $(lsb_release -d | cut -f2)
Docker: $(docker --version)
Docker Compose: $(docker compose version)

Available Scripts:
- start.sh    - Запустить приложение
- stop.sh     - Остановить приложение  
- restart.sh  - Перезапустить приложение
- logs.sh     - Просмотр логов
- status.sh   - Статус контейнеров
- backup.sh   - Backup базы данных
- update.sh   - Обновление приложения

Configuration:
- .env.prod   - Production настройки
- docker-compose.prod.yml - Production конфигурация
EOF

log ""
log "Установка завершена!"
log "Следуйте инструкциям в VDS_DEPLOYMENT_GUIDE.md для продолжения"
log ""
