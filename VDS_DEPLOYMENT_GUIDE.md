# Пошаговое руководство по развертыванию VBallAgregator на VDS

## Информация о сервере
- **IP-адрес:** 45.143.95.171
- **Пользователь:** root
- **ОС:** Ubuntu 20.04 LTS
- **Конфигурация:** 1x2.2ГГц, 0.5Гб RAM, 10Гб SSD

## Шаг 6: Подготовка VDS (установка Docker, Docker Compose, Git)

### 1. Подключение к серверу
```bash
ssh root@45.143.95.171
# Пароль: oTbG41y5Qq
```

### 2. Обновление системы
```bash
apt update && apt upgrade -y
```

### 3. Установка необходимых пакетов
```bash
apt install -y curl wget git unzip software-properties-common apt-transport-https ca-certificates gnupg lsb-release
```

### 4. Установка Docker
```bash
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg

echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null

apt update
apt install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
```

### 5. Проверка установки Docker
```bash
docker --version
docker compose version
systemctl enable docker
systemctl start docker
```

### 6. Настройка Docker (без sudo для root)
```bash
# Для пользователя root Docker уже доступен без sudo
docker run hello-world
```

## Шаг 7: Клонирование проекта на VDS

### 1. Переход в домашнюю директорию
```bash
cd /root
```

### 2. Клонирование репозитория
```bash
# Замените YOUR_REPO_URL на URL вашего Git репозитория
git clone https://github.com/your-username/VBallAgregator.git
# или
git clone git@github.com:your-username/VBallAgregator.git

cd VBallAgregator
```

## Шаг 8: Настройка .env.prod на VDS

### 1. Создание production конфигурации
```bash
# Скопировать пример конфигурации
cp .env.prod .env.prod.backup

# Редактировать production конфигурацию
nano .env.prod
```

### 2. Ключевые параметры для production .env.prod
```bash
# Безопасность
NODE_ENV=production
LOG_LEVEL=info

# База данных (используйте локальные настройки)
DATABASE_URL="postgresql://vball_app:YOUR_STRONG_PASSWORD@db:5432/vball_prod"

# Redis
REDIS_HOST=redis
REDIS_PORT=6379
REDIS_PASSWORD=YOUR_REDIS_PASSWORD

# Telegram Bot
TELEGRAM_BOT_TOKEN=YOUR_BOT_TOKEN_FROM_BOTFATHER

# API
API_HOST=0.0.0.0
API_PORT=3000
API_BASE_URL=http://45.143.95.171:3000

# Безопасность
JWT_SECRET=$(openssl rand -base64 32)
TELEGRAM_WEBHOOK_SECRET=$(openssl rand -base64 32)

# Логирование
LOG_FILE_PATH=/opt/vball-aggregator/logs/app.log
LOG_OUTPUT=file
```

## Шаг 9: Создание необходимых директорий на VDS

### 1. Создание production директорий
```bash
mkdir -p /opt/vball-aggregator/{data/postgres,data/redis,logs,backups,certs}
mkdir -p logs backups
```

### 2. Установка прав доступа
```bash
chmod -R 755 /opt/vball-aggregator
chmod 600 .env.prod
```

## Шаг 10: Запуск контейнеров на VDS

### 1. Сборка и запуск production контейнеров
```bash
# Остановить все контейнеры если есть
docker compose down

# Собрать production образы
docker compose -f docker-compose.prod.yml build --no-cache

# Запустить production контейнеры
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d
```

### 2. Проверка статуса контейнеров
```bash
docker compose -f docker-compose.prod.yml ps
```

## Шаг 11: Выполнение миграций БД на VDS

### 1. Ожидание готовности БД
```bash
# Подождать пока БД станет здоровой
sleep 30
docker compose -f docker-compose.prod.yml ps
```

### 2. Выполнение миграций
```bash
# Выполнить миграции БД
docker compose -f docker-compose.prod.yml exec app npm run prisma:migrate
```

### 3. Проверка миграций
```bash
# Проверить состояние миграций
docker compose -f docker-compose.prod.yml exec app npx prisma migrate status
```

## Шаг 12: Проверка работоспособности на VDS

### 1. Проверка логов приложения
```bash
# Просмотр логов приложения
docker compose -f docker-compose.prod.yml logs -f app

# В отдельном терминале проверить статус
docker compose -f docker-compose.prod.yml ps
```

### 2. Проверка API endpoint
```bash
# Проверка health check
curl http://localhost:3000/health
```

### 3. Проверка работы бота
```bash
# Отправить команду /start вашему боту в Telegram
# Проверить логи бота
docker compose -f docker-compose.prod.yml logs bot
```

## Дополнительные команды управления

### Мониторинг
```bash
# Просмотр всех логов
docker compose -f docker-compose.prod.yml logs

# Мониторинг ресурсов
docker stats

# Проверка дискового пространства
df -h
```

### Обслуживание
```bash
# Остановка сервисов
docker compose -f docker-compose.prod.yml down

# Обновление и перезапуск
git pull
docker compose -f docker-compose.prod.yml build --no-cache
docker compose -f docker-compose.prod.yml up -d

# Создание резервной копии БД
docker compose -f docker-compose.prod.yml exec db pg_dump -U vball_app vball_prod > backup_$(date +%Y%m%d_%H%M%S).sql
```

### Настройка автозапуска
```bash
# Добавление в автозагрузку
systemctl enable docker

# Создание systemd сервиса для автозапуска приложения
cat > /etc/systemd/system/vball-aggregator.service << EOF
[Unit]
Description=VBallAgregator Docker Compose application
Requires=docker.service
After=docker.service

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=/root/VBallAgregator
ExecStart=/usr/bin/docker compose -f docker-compose.prod.yml --env-file .env.prod up -d
ExecStop=/usr/bin/docker compose -f docker-compose.prod.yml down
TimeoutStartSec=0

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable vball-aggregator
```

## Решение проблем

### Проблемы с сетью
```bash
# Проверка портов
netstat -tlnp | grep :3000
netstat -tlnp | grep :5432
netstat -tlnp | grep :6379
```

### Проблемы с Docker
```bash
# Перезапуск Docker
systemctl restart docker

# Очистка неиспользуемых образов
docker system prune -a
```

### Проблемы с БД
```bash
# Проверка подключения к БД
docker compose -f docker-compose.prod.yml exec db psql -U vball_app -d vball_prod -c "SELECT version();"
```

## Безопасность

### Настройка файервола
```bash
# Установка UFW
apt install -y ufw

# Настройка базовых правил
ufw default deny incoming
ufw default allow outgoing
ufw allow ssh
ufw allow 80/tcp
ufw allow 443/tcp
ufw allow 3000/tcp

# Включение файервола
ufw enable
```

### Смена SSH порта (рекомендуется)
```bash
# Редактировать конфиг SSH
nano /etc/ssh/sshd_config

# Изменить Port 22 на Port 2222
# Перезапустить SSH
systemctl restart ssh
```

---

## Итог
После выполнения всех шагов ваш Telegram бот VBallAgregator будет запущен на VDS и готов к работе!
