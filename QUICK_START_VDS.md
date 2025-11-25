# 🚀 Быстрый старт развертывания VBallAgregator на VDS

## Информация о сервере
- **IP:** 45.143.95.171
- **Пользователь:** root  
- **Пароль:** oTbG41y5Qq

## Способ 1: Автоматическая установка (рекомендуется)

### 1. Скопируйте и выполните скрипт установки
```bash
# Подключение к серверу
ssh root@45.143.95.171
# Пароль: oTbG41y5Qq

# Скопируйте и выполните скрипт автоматической установки
wget -O setup.sh https://your-domain.com/scripts/vds-setup.sh
chmod +x setup.sh
./setup.sh
```

## Способ 2: Ручная установка

### 1. Подключение к серверу
```bash
ssh root@45.143.95.171
```

### 2. Базовая установка
```bash
# Обновление системы
apt update && apt upgrade -y

# Установка Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh
systemctl enable docker
systemctl start docker

# Проверка
docker --version
docker compose version
```

### 3. Подготовка проекта
```bash
# Создание директории
mkdir -p /opt/vball-aggregator
cd /opt/vball-aggregator

# Клонирование репозитория (замените URL)
git clone https://github.com/your-username/VBallAgregator.git .

# Копирование production конфигурации
cp .env.prod .env.prod.example

# Редактирование настроек
nano .env.prod
```

## Настройка .env.prod

**Обязательно измените следующие параметры:**

```bash
# Безопасные пароли
DATABASE_URL="postgresql://vball_app:GENERATE_STRONG_PASSWORD@db:5432/vball_prod"
REDIS_PASSWORD=GENERATE_STRONG_REDIS_PASSWORD

# Telegram Bot Token (от @BotFather)
TELEGRAM_BOT_TOKEN=YOUR_BOT_TOKEN

# API URL (замените IP)
API_BASE_URL=http://45.143.95.171:3000

# Автогенерация секретов
JWT_SECRET=$(openssl rand -base64 32)
TELEGRAM_WEBHOOK_SECRET=$(openssl rand -base64 32)
```

## Запуск приложения

```bash
# Сборка и запуск
cd /opt/vball-aggregator
docker compose -f docker-compose.prod.yml --env-file .env.prod build --no-cache
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d

# Выполнение миграций
docker compose -f docker-compose.prod.yml exec app npm run prisma:migrate

# Проверка статуса
docker compose -f docker-compose.prod.yml ps
```

## Проверка работы

```bash
# Логи приложения
docker compose -f docker-compose.prod.yml logs -f app

# Статус контейнеров
docker compose -f docker-compose.prod.yml ps

# Health check
curl http://localhost:3000/health
```

## Полезные команды

```bash
# Управление
./start.sh     # Запуск
./stop.sh      # Остановка  
./restart.sh   # Перезапуск
./logs.sh      # Логи
./status.sh    # Статус
./backup.sh    # Backup БД
./update.sh    # Обновление

# Мониторинг
docker stats
df -h
free -h
```

## Решение проблем

### Проблемы с портами
```bash
# Проверка занятых портов
netstat -tlnp | grep :3000
netstat -tlnp | grep :5432
netstat -tlnp | grep :6379
```

### Проблемы с Docker
```bash
# Перезапуск Docker
systemctl restart docker

# Очистка
docker system prune -a
```

### Проблемы с БД
```bash
# Проверка подключения
docker compose -f docker-compose.prod.yml exec db psql -U vball_app -d vball_prod
```

## Безопасность

```bash
# Настройка файервола
apt install -y ufw
ufw default deny incoming
ufw default allow outgoing
ufw allow ssh
ufw allow 80/tcp
ufw allow 443/tcp
ufw allow 3000/tcp
ufw enable

# Смена SSH порта (опционально)
nano /etc/ssh/sshd_config
# Изменить Port 22 на Port 2222
systemctl restart ssh
```

## Автозапуск

```bash
# Включение автозапуска Docker
systemctl enable docker

# Включение автозапуска приложения
systemctl enable vball-aggregator
```

## Итог

После выполнения этих шагов ваш Telegram бот VBallAgregator будет работать на VDS!

**Проверьте работу:**
1. Отправьте `/start` вашему боту в Telegram
2. Проверьте логи: `docker compose logs -f app`
3. Откройте http://45.143.95.171:3000/health

---
💡 **Подробные инструкции:** `VDS_DEPLOYMENT_GUIDE.md`
🛠️ **Автоскрипт:** `scripts/vds-setup.sh`
