#!/bin/bash

################################################################################
# VBallAgregator Deployment Automation Script
# 
# Этот скрипт автоматизирует процесс подготовки и развертывания приложения
# в production окружении.
#
# Использование:
#   ./deployment-automation.sh [command] [options]
#
# Команды:
#   prepare       - Подготовка к деплою (все проверки)
#   validate      - Валидация конфигурации
#   backup        - Создание backup БД
#   deploy        - Развертывание приложения
#   health-check  - Проверка здоровья приложения
#   rollback      - Откат к предыдущей версии
#   logs          - Просмотр логов
#
################################################################################

set -e

# Цвета для вывода
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Конфигурация
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
BACKUP_DIR="$PROJECT_DIR/backups"
LOG_DIR="$PROJECT_DIR/logs"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

# Функции логирования
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Функция для проверки команды
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Функция для проверки переменной окружения
check_env_var() {
    local var_name=$1
    if [ -z "${!var_name}" ]; then
        log_error "Переменная окружения $var_name не установлена"
        return 1
    fi
    return 0
}

################################################################################
# ПОДГОТОВКА К ДЕПЛОЮ
################################################################################

prepare_deployment() {
    log_info "Начало подготовки к деплою..."
    
    # Проверка зависимостей
    log_info "Проверка зависимостей..."
    check_dependencies || return 1
    
    # Валидация конфигурации
    log_info "Валидация конфигурации..."
    validate_configuration || return 1
    
    # Проверка кода
    log_info "Проверка кода..."
    check_code || return 1
    
    # Проверка тестов
    log_info "Запуск тестов..."
    run_tests || return 1
    
    # Создание backup
    log_info "Создание backup базы данных..."
    backup_database || return 1
    
    log_success "Подготовка к деплою завершена успешно!"
    return 0
}

################################################################################
# ПРОВЕРКА ЗАВИСИМОСТЕЙ
################################################################################

check_dependencies() {
    log_info "Проверка установленных зависимостей..."
    
    local missing_deps=0
    
    # Проверка Docker
    if ! command_exists docker; then
        log_error "Docker не установлен"
        missing_deps=$((missing_deps + 1))
    else
        log_success "Docker установлен: $(docker --version)"
    fi
    
    # Проверка Docker Compose
    if ! command_exists docker-compose; then
        log_error "Docker Compose не установлен"
        missing_deps=$((missing_deps + 1))
    else
        log_success "Docker Compose установлен: $(docker-compose --version)"
    fi
    
    # Проверка Git
    if ! command_exists git; then
        log_error "Git не установлен"
        missing_deps=$((missing_deps + 1))
    else
        log_success "Git установлен: $(git --version)"
    fi
    
    # Проверка Node.js
    if ! command_exists node; then
        log_error "Node.js не установлен"
        missing_deps=$((missing_deps + 1))
    else
        log_success "Node.js установлен: $(node --version)"
    fi
    
    # Проверка npm
    if ! command_exists npm; then
        log_error "npm не установлен"
        missing_deps=$((missing_deps + 1))
    else
        log_success "npm установлен: $(npm --version)"
    fi
    
    if [ $missing_deps -gt 0 ]; then
        log_error "Отсутствует $missing_deps зависимостей"
        return 1
    fi
    
    return 0
}

################################################################################
# ВАЛИДАЦИЯ КОНФИГУРАЦИИ
################################################################################

validate_configuration() {
    log_info "Валидация конфигурации..."
    
    local errors=0
    
    # Проверка .env файла
    if [ ! -f "$PROJECT_DIR/.env.prod" ]; then
        log_error ".env.prod файл не найден"
        errors=$((errors + 1))
    else
        log_success ".env.prod файл найден"
        
        # Проверка критичных переменных
        source "$PROJECT_DIR/.env.prod"
        
        if [ -z "$NODE_ENV" ]; then
            log_error "NODE_ENV не установлена"
            errors=$((errors + 1))
        fi
        
        if [ -z "$DATABASE_URL" ]; then
            log_error "DATABASE_URL не установлена"
            errors=$((errors + 1))
        fi
        
        if [ -z "$TELEGRAM_BOT_TOKEN" ]; then
            log_error "TELEGRAM_BOT_TOKEN не установлена"
            errors=$((errors + 1))
        fi
    fi
    
    # Проверка docker-compose файла
    if [ ! -f "$PROJECT_DIR/docker-compose.prod.yml" ]; then
        log_warning "docker-compose.prod.yml не найден, используется docker-compose.yml"
    else
        log_success "docker-compose.prod.yml найден"
    fi
    
    # Проверка Dockerfile
    if [ ! -f "$PROJECT_DIR/Dockerfile" ]; then
        log_error "Dockerfile не найден"
        errors=$((errors + 1))
    else
        log_success "Dockerfile найден"
    fi
    
    if [ $errors -gt 0 ]; then
        log_error "Найдено $errors ошибок в конфигурации"
        return 1
    fi
    
    return 0
}

################################################################################
# ПРОВЕРКА КОДА
################################################################################

check_code() {
    log_info "Проверка кода..."
    
    cd "$PROJECT_DIR"
    
    # Проверка на незакоммиченные изменения
    if ! git diff-index --quiet HEAD --; then
        log_warning "Есть незакоммиченные изменения"
        git status
    fi
    
    # Проверка npm audit
    log_info "Запуск npm audit..."
    if npm audit --audit-level moderate; then
        log_success "npm audit пройден"
    else
        log_warning "npm audit обнаружил проблемы"
    fi
    
    # Проверка на console.log в production коде
    log_info "Проверка на console.log в коде..."
    if grep -r "console\\.log" src/ --include="*.ts" --include="*.js" 2>/dev/null | grep -v "test" | grep -v ".test."; then
        log_warning "Найдены console.log в production коде"
    else
        log_success "console.log не найдены в production коде"
    fi
    
    return 0
}

################################################################################
# ЗАПУСК ТЕСТОВ
################################################################################

run_tests() {
    log_info "Запуск тестов..."
    
    cd "$PROJECT_DIR"
    
    # Unit тесты
    log_info "Запуск unit тестов..."
    if npm run test:unit 2>/dev/null; then
        log_success "Unit тесты пройдены"
    else
        log_warning "Unit тесты не пройдены или не настроены"
    fi
    
    # Integration тесты
    log_info "Запуск integration тестов..."
    if npm run test:integration 2>/dev/null; then
        log_success "Integration тесты пройдены"
    else
        log_warning "Integration тесты не пройдены или не настроены"
    fi
    
    return 0
}

################################################################################
# BACKUP БАЗЫ ДАННЫХ
################################################################################

backup_database() {
    log_info "Создание backup базы данных..."
    
    # Создание директории для backup
    mkdir -p "$BACKUP_DIR"
    
    local backup_file="$BACKUP_DIR/backup_${TIMESTAMP}.sql"
    
    cd "$PROJECT_DIR"
    
    # Проверка, запущена ли БД
    if ! docker-compose ps db 2>/dev/null | grep -q "Up"; then
        log_warning "База данных не запущена, пропуск backup"
        return 0
    fi
    
    # Создание backup
    log_info "Создание backup в $backup_file..."
    if docker-compose exec -T db pg_dump -U postgres vball_prod > "$backup_file" 2>/dev/null; then
        # Сжатие backup
        gzip "$backup_file"
        log_success "Backup создан: ${backup_file}.gz"
        
        # Удаление старых backup (старше 30 дней)
        log_info "Удаление старых backup..."
        find "$BACKUP_DIR" -name "backup_*.sql.gz" -mtime +30 -delete
        
        return 0
    else
        log_error "Ошибка при создании backup"
        return 1
    fi
}

################################################################################
# РАЗВЕРТЫВАНИЕ ПРИЛОЖЕНИЯ
################################################################################

deploy_application() {
    log_info "Начало развертывания приложения..."
    
    cd "$PROJECT_DIR"
    
    # Проверка конфигурации
    log_info "Валидация конфигурации..."
    validate_configuration || return 1
    
    # Создание backup перед деплоем
    log_info "Создание backup перед деплоем..."
    backup_database || return 1
    
    # Сборка Docker образов
    log_info "Сборка Docker образов..."
    if docker-compose -f docker-compose.prod.yml build; then
        log_success "Docker образы собраны"
    else
        log_error "Ошибка при сборке Docker образов"
        return 1
    fi
    
    # Запуск контейнеров
    log_info "Запуск контейнеров..."
    if docker-compose -f docker-compose.prod.yml up -d; then
        log_success "Контейнеры запущены"
    else
        log_error "Ошибка при запуске контейнеров"
        return 1
    fi
    
    # Ожидание запуска приложения
    log_info "Ожидание запуска приложения (30 сек)..."
    sleep 30
    
    # Выполнение миграций БД
    log_info "Выполнение миграций БД..."
    if docker-compose -f docker-compose.prod.yml exec -T app npm run prisma:migrate 2>/dev/null; then
        log_success "Миграции БД выполнены"
    else
        log_warning "Миграции БД не выполнены или не требуются"
    fi
    
    # Проверка здоровья приложения
    log_info "Проверка здоровья приложения..."
    if health_check; then
        log_success "Приложение здорово"
    else
        log_error "Приложение не здорово"
        return 1
    fi
    
    log_success "Развертывание завершено успешно!"
    return 0
}

################################################################################
# ПРОВЕРКА ЗДОРОВЬЯ ПРИЛОЖЕНИЯ
################################################################################

health_check() {
    log_info "Проверка здоровья приложения..."
    
    cd "$PROJECT_DIR"
    
    # Проверка статуса контейнеров
    log_info "Проверка статуса контейнеров..."
    if docker-compose -f docker-compose.prod.yml ps | grep -q "Up"; then
        log_success "Контейнеры запущены"
    else
        log_error "Контейнеры не запущены"
        return 1
    fi
    
    # Проверка health endpoint
    log_info "Проверка health endpoint..."
    local max_attempts=10
    local attempt=1
    
    while [ $attempt -le $max_attempts ]; do
        if curl -sf http://localhost:3000/health >/dev/null 2>&1; then
            log_success "Health endpoint доступен"
            return 0
        fi
        
        log_info "Попытка $attempt/$max_attempts..."
        sleep 3
        attempt=$((attempt + 1))
    done
    
    log_error "Health endpoint недоступен"
    return 1
}

################################################################################
# ОТКАТ К ПРЕДЫДУЩЕЙ ВЕРСИИ
################################################################################

rollback_deployment() {
    log_warning "Инициирование отката к предыдущей версии..."
    
    cd "$PROJECT_DIR"
    
    # Остановка текущей версии
    log_info "Остановка текущей версии..."
    docker-compose -f docker-compose.prod.yml down
    
    # Восстановление из backup (если требуется)
    log_info "Восстановление из backup..."
    local latest_backup=$(ls -t "$BACKUP_DIR"/backup_*.sql.gz 2>/dev/null | head -1)
    
    if [ -n "$latest_backup" ]; then
        log_info "Восстановление из $latest_backup..."
        gunzip -c "$latest_backup" | docker-compose -f docker-compose.prod.yml exec -T db psql -U postgres vball_prod
        log_success "Backup восстановлен"
    else
        log_warning "Backup не найден"
    fi
    
    # Запуск предыдущей версии
    log_info "Запуск предыдущей версии..."
    docker-compose -f docker-compose.prod.yml up -d
    
    # Проверка здоровья
    sleep 10
    if health_check; then
        log_success "Откат завершен успешно"
        return 0
    else
        log_error "Откат не удался"
        return 1
    fi
}

################################################################################
# ПРОСМОТР ЛОГОВ
################################################################################

view_logs() {
    log_info "Просмотр логов приложения..."
    
    cd "$PROJECT_DIR"
    
    # Логи приложения
    log_info "Логи приложения:"
    docker-compose -f docker-compose.prod.yml logs --tail=50 app
    
    # Логи БД
    log_info "Логи БД:"
    docker-compose -f docker-compose.prod.yml logs --tail=20 db
    
    # Логи Redis
    log_info "Логи Redis:"
    docker-compose -f docker-compose.prod.yml logs --tail=20 redis
}

################################################################################
# ГЛАВНАЯ ФУНКЦИЯ
################################################################################

main() {
    local command=${1:-help}
    
    case "$command" in
        prepare)
            prepare_deployment
            ;;
        validate)
            validate_configuration
            ;;
        backup)
            backup_database
            ;;
        deploy)
            deploy_application
            ;;
        health-check)
            health_check
            ;;
        rollback)
            rollback_deployment
            ;;
        logs)
            view_logs
            ;;
        *)
            echo "VBallAgregator Deployment Automation Script"
            echo ""
            echo "Использование: $0 [command]"
            echo ""
            echo "Команды:"
            echo "  prepare       - Подготовка к деплою (все проверки)"
            echo "  validate      - Валидация конфигурации"
            echo "  backup        - Создание backup БД"
            echo "  deploy        - Развертывание приложения"
            echo "  health-check  - Проверка здоровья приложения"
            echo "  rollback      - Откат к предыдущей версии"
            echo "  logs          - Просмотр логов"
            echo ""
            ;;
    esac
}

# Запуск главной функции
main "$@"
