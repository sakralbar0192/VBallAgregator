# Руководство по развертыванию

## Обзор
Данное руководство описывает процесс развертывания VBallAgregator бота в различных средах: разработки, тестирования и продакшена.

## Содержание
- [Предварительные требования](#предварительные-требования)
- [Развертывание в Docker](#развертывание-в-docker)
- [Развертывание в продакшене](#развертывание-в-продакшене)
- [Настройка переменных окружения](#настройка-переменных-окружения)
- [База данных](#база-данных)
- [Мониторинг и логирование](#мониторинг-и-логирование)
- [Резервное копирование](#резервное-копирование)
- [Обновление системы](#обновление-системы)

## Предварительные требования

### Системные требования
- **ОС**: Linux (Ubuntu 20.04+ рекомендуется)
- **RAM**: Минимум 2 ГБ, рекомендуется 4 ГБ+
- **Диск**: Минимум 20 ГБ свободного места
- **CPU**: 2+ ядра

### Программное обеспечение
- Docker (v20.10+)
- Docker Compose (v2.0+)
- Node.js (v18+) - для локальной разработки
- PostgreSQL (v13+) - для локальной разработки

### Доступы и токены
- Telegram Bot Token от @BotFather
- Доступ к серверу (SSH ключи)
- SSL сертификаты для HTTPS
- Доступ к базе данных (продакшен)

## Развертывание в Docker

### Сборка образов

```bash
# Клонирование репозитория
git clone <repository-url>
cd VBallAgregator

# Сборка образа приложения
docker build -t vball-aggregator:latest .

# Сборка образа базы данных (если нужно)
docker build -f Dockerfile.db -t postgres-vball:latest .
```

### Запуск с Docker Compose

#### Development окружение
```bash
# Создание .env файла
cp .env.example .env
# Редактирование переменных окружения

# Запуск сервисов
docker-compose up -d

# Просмотр логов
docker-compose logs -f

# Остановка сервисов
docker-compose down
```

#### Production окружение
```bash
# Запуск с production конфигурацией
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d

# Проверка состояния контейнеров
docker-compose ps
```

### Проверка развертывания

```bash
# Проверка доступности API
curl http://localhost:3000/health

# Проверка логов бота
docker-compose logs bot

# Проверка базы данных
docker-compose exec db psql -U postgres -d vball_db -c "SELECT version();"
```

## Развертывание в продакшене

### Подготовка сервера

#### Обновление системы
```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y docker.io docker-compose git nginx certbot python3-certbot-nginx
```

#### Настройка Docker
```bash
# Добавление пользователя в группу docker
sudo usermod -aG docker $USER

# Перезагрузка для применения изменений
newgrp docker

# Проверка работы Docker
docker --version
docker-compose --version
```

#### Настройка брандмауэра
```bash
# Настройка UFW
sudo ufw enable
sudo ufw allow ssh
sudo ufw allow 80
sudo ufw allow 443
sudo ufw allow 3000  # для API (если нужно)
```

### Конфигурация домена и SSL

#### Nginx конфигурация
```nginx
# /etc/nginx/sites-available/vball-aggregator
server {
    listen 80;
    server_name your-domain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name your-domain.com;

    ssl_certificate /etc/letsencrypt/live/your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;

    # Проксирование на приложение
    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # WebSocket поддержка (если нужно)
    location /ws {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

#### Получение SSL сертификата
```bash
# Создание конфигурации Nginx для домена
sudo nano /etc/nginx/sites-available/vball-aggregator
sudo ln -s /etc/nginx/sites-available/vball-aggregator /etc/nginx/sites-enabled/

# Получение SSL сертификата
sudo certbot --nginx -d your-domain.com

# Автоматическое обновление сертификатов
sudo crontab -e
# Добавить: 0 12 * * * /usr/bin/certbot renew --quiet
```

### Развертывание приложения

#### Подготовка директории
```bash
# Создание рабочей директории
sudo mkdir -p /opt/vball-aggregator
sudo chown $USER:$USER /opt/vball-aggregator
cd /opt/vball-aggregator

# Клонирование репозитория
git clone <repository-url> .
```

#### Конфигурация продакшена
```bash
# Создание .env файла для продакшена
cp .env.example .env.prod

# Редактирование критичных параметров
nano .env.prod
```

#### Запуск продакшен сервисов
```bash
# Запуск в фоновом режиме
docker-compose -f docker-compose.prod.yml up -d

# Проверка статуса
docker-compose -f docker-compose.prod.yml ps

# Просмотр логов
docker-compose -f docker-compose.prod.yml logs -f
```

## Настройка переменных окружения

### Критичные параметры продакшена

#### Безопасность
```env
NODE_ENV=production
JWT_SECRET=your-super-secret-jwt-key-here
TELEGRAM_BOT_TOKEN=your_bot_token_here
DATABASE_URL=postgresql://user:password@db:5432/vball_db
```

#### Приложение
```env
PORT=3000
API_BASE_URL=https://your-domain.com
FRONTEND_URL=https://your-domain.com
WEBHOOK_URL=https://your-domain.com/webhook
```

#### База данных
```env
DB_HOST=db
DB_PORT=5432
DB_NAME=vball_db
DB_USER=postgres
DB_PASSWORD=secure_password_here
```

#### Внешние сервисы
```env
REDIS_URL=redis://redis:6379
PAYMENT_API_KEY=your_payment_api_key
EMAIL_SERVICE_API_KEY=your_email_api_key
```

### Автоматическая настройка
```bash
# Создание скрипта настройки окружения
cat > setup-env.sh << 'EOF'
#!/bin/bash

# Генерация секретных ключей
JWT_SECRET=$(openssl rand -base64 32)
TELEGRAM_BOT_TOKEN="123456789:ABC-DEF1234ghIkl-zyx57W2v1u123ew11"

# Обновление .env файла
sed -i "s/your-jwt-secret/$JWT_SECRET/g" .env
sed -i "s/your_bot_token_here/$TELEGRAM_BOT_TOKEN/g" .env

echo "Environment configured successfully!"
EOF

chmod +x setup-env.sh
./setup-env.sh
```

## База данных

### Миграции
```bash
# Запуск миграций при развертывании
docker-compose exec app npx prisma migrate deploy

# Генерация Prisma клиента
docker-compose exec app npx prisma generate

# Проверка состояния миграций
docker-compose exec app npx prisma migrate status
```

### Резервное копирование базы данных

#### Автоматические бэкапы
```bash
# Создание скрипта резервного копирования
cat > backup-db.sh << 'EOF'
#!/bin/bash

BACKUP_DIR="/opt/backups"
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/vball_db_backup_$DATE.sql"

# Создание директории для бэкапов
mkdir -p $BACKUP_DIR

# Создание бэкапа
docker-compose exec -T db pg_dump -U postgres vball_db > $BACKUP_FILE

# Сжатие бэкапа
gzip $BACKUP_FILE

# Удаление бэкапов старше 30 дней
find $BACKUP_DIR -name "*.sql.gz" -mtime +30 -delete

echo "Backup created: $BACKUP_FILE.gz"
EOF

chmod +x backup-db.sh

# Добавление в cron для ежедневного бэкапа
(crontab -l 2>/dev/null; echo "0 2 * * * /opt/vball-aggregator/backup-db.sh >> /var/log/backup.log 2>&1") | crontab -
```

#### Восстановление из бэкапа
```bash
# Остановка приложения
docker-compose down

# Восстановление базы данных
gunzip -c /opt/backups/vball_db_backup_20231124_020000.sql.gz | docker-compose exec -T db psql -U postgres vball_db

# Запуск приложения
docker-compose up -d
```

### Мониторинг базы данных
```bash
# Проверка состояния подключений
docker-compose exec db psql -U postgres -d vball_db -c "SELECT count(*) as active_connections FROM pg_stat_activity WHERE state = 'active';"

# Проверка размера базы данных
docker-compose exec db psql -U postgres -d vball_db -c "SELECT pg_size_pretty(pg_database_size('vball_db'));"
```

## 🔒 Безопасность

### Принципы безопасности

VBallAgregator следует принципам безопасности "Defense in Depth" с многоуровневой защитой:

1. **Безопасность на уровне инфраструктуры**
2. **Безопасность на уровне приложения**  
3. **Безопасность на уровне данных**
4. **Безопасность на уровне сети**

### Контрольный список безопасности для продакшена

#### ✅ Инфраструктурная безопасность
- [ ] **Firewall настроен** - только необходимые порты открыты (22, 80, 443)
- [ ] **SSH ключи вместо паролей** - отключена аутентификация по паролю
- [ ] **Обновления системы** - регулярные обновления ОС и пакетов
- [ ] **Fail2Ban настроен** - защита от brute-force атак
- [ ] **Мониторинг входа в систему** - логирование всех SSH подключений

#### ✅ Сетевая безопасность
- [ ] **HTTPS обязателен** - все соединения шифруются
- [ ] **HTTP заголовки безопасности** - CSP, HSTS, X-Frame-Options
- [ ] **CORS настроен правильно** - только доверенные домены
- [ ] **VPC/Private Network** - изоляция сервисов базы данных

#### ✅ Безопасность приложения
- [ ] **Telegram webhook безопасность** - проверка подписи webhook
- [ ] **Rate limiting активен** - защита от спама и DoS
- [ ] **Валидация входных данных** - все пользовательские данные валидируются
- [ ] **Логирование безопасности** - аудит всех критичных операций
- [ ] **Конфиденциальные данные в секретах** - никаких токенов в коде

#### ✅ Безопасность базы данных
- [ ] **Сильные пароли БД** - минимум 16 символов, спецсимволы
- [ ] **Ограниченные права доступа** - пользователь БД только необходимые права
- [ ] **SSL подключения к БД** - шифрование передачи данных
- [ ] **Регулярные бэкапы** - зашифрованные резервные копии
- [ ] **Мониторинг подозрительной активности** - необычные запросы

### Настройка брандмауэра (UFW)

```bash
# Сброс правил
sudo ufw --force reset

# Базовые правила
sudo ufw default deny incoming
sudo ufw default allow outgoing

# SSH (ограничить по IP)
sudo ufw allow from YOUR_ADMIN_IP to any port 22

# HTTP/HTTPS
sudo ufw allow 80
sudo ufw allow 443

# API порт (только для internal use)
sudo ufw allow from 10.0.0.0/8 to any port 3000

# Активация
sudo ufw --force enable

# Проверка статуса
sudo ufw status verbose
```

### Безопасность SSH

```bash
# Редактирование конфигурации SSH
sudo nano /etc/ssh/sshd_config

# Критичные настройки:
PermitRootLogin no                    # Запрет root входа
PasswordAuthentication no             # Только ключи
PubkeyAuthentication yes              # Публичные ключи
MaxAuthTries 3                        # Максимум 3 попытки
ClientAliveInterval 300               # Таймаут сессии
ClientAliveCountMax 2                 # Максимум проверок

# Перезагрузка SSH
sudo systemctl reload sshd

# Генерация ключей (на клиенте)
ssh-keygen -t ed25519 -f ~/.ssh/vball_key
ssh-copy-id -i ~/.ssh/vball_key.pub user@server
```

## Секретное управление (Secret Management)

### Лучшие практики хранения секретов

#### 1. Никогда не храните секреты в коде

```bash
# ❌ ПЛОХО: Секрет в коде
const TELEGRAM_TOKEN = "123456789:ABCdefGHIjklMNOpqrsTUVwxyz";

# ✅ ХОРОШО: Секрет из переменной окружения
const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
```

#### 2. Используйте менеджеры секретов

**AWS Secrets Manager**:
```bash
#!/bin/bash
# scripts/load-secrets-aws.sh

# Получение секретов из AWS
export TELEGRAM_BOT_TOKEN=$(aws secretsmanager get-secret-value \
  --secret-id vball/telegram-bot-token \
  --query 'SecretString' --output text | jq -r '.token')

export DATABASE_URL=$(aws secretsmanager get-secret-value \
  --secret-id vball/database-connection \
  --query 'SecretString' --output text | jq -r '.connection_string')

# Проверка загрузки
if [ -z "$TELEGRAM_BOT_TOKEN" ] || [ -z "$DATABASE_URL" ]; then
  echo "ERROR: Failed to load secrets from AWS"
  exit 1
fi

echo "Secrets loaded successfully from AWS Secrets Manager"
```

**HashiCorp Vault**:
```bash
#!/bin/bash
# scripts/load-secrets-vault.sh

# Аутентификация в Vault (используйте service account или token)
export VAULT_TOKEN=$(vault print token)

# Получение секретов
export TELEGRAM_BOT_TOKEN=$(vault kv get -field=token secret/vball/telegram)
export DATABASE_URL=$(vault kv get -field=connection_string secret/vball/database)

echo "Secrets loaded from HashiCorp Vault"
```

**Docker Secrets** (для Swarm режима):
```yaml
# docker-compose.secrets.yml
version: '3.8'
services:
  app:
    secrets:
      - telegram_token
      - db_password
    environment:
      - TELEGRAM_BOT_TOKEN_FILE_RUN/secrets/telegram_token
      - DATABASE_PASSWORD_FILE_RUN/secrets/db_password

secrets:
  telegram_token:
    file: ./secrets/telegram_token.txt
  db_password:
    file: ./secrets/db_password.txt
```

#### 3. Автоматическая ротация секретов

```bash
#!/bin/bash
# scripts/rotate-secrets.sh

# Ротация Telegram Bot Token
OLD_TOKEN=$(vault kv get -field=token secret/vball/telegram)
NEW_TOKEN=$(generate_new_telegram_token)

# Обновление в Vault
vault kv patch secret/vball/telegram token="$NEW_TOKEN"

# Обновление в Telegram
curl -X POST "https://api.telegram.org/bot$NEW_TOKEN/setWebhook" \
     -d "url=https://bot.vballaggregator.com/webhook"

# Проверка работы нового токена
if curl -f "https://api.telegram.org/bot$NEW_TOKEN/getMe" > /dev/null; then
  echo "New token working correctly"
  # Можно деактивировать старый токен
  vault kv patch secret/vball/telegram old_token="$OLD_TOKEN"
else
  echo "New token failed, keeping old one"
  exit 1
fi
```

## Сканирование уязвимостей

### Автоматическое сканирование кода

#### Настройка GitHub Security Code Scanning
```yaml
# .github/workflows/security-scan.yml
name: Security Scan

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main ]

jobs:
  security-scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Run CodeQL Analysis
        uses: github/codeql-action/init@v2
        with:
          languages: javascript,typescript
          
      - name: Autobuild
        uses: github/codeql-action/autobuild@v2
        
      - name: Perform CodeQL Analysis
        uses: github/codeql-action/analyze@v2
```

#### SAST (Static Application Security Testing)
```bash
#!/bin/bash
# scripts/sast-scan.sh

echo "Starting SAST scan with Semgrep..."

# Установка Semgrep
pip3 install semgrep

# Сканирование на уязвимости
semgrep --config=auto --json --output=semgrep-results.json src/

# Проверка критичных находок
CRITICAL_ISSUES=$(jq '.results | map(select(.severity == "ERROR")) | length' semgrep-results.json)

if [ $CRITICAL_ISSUES -gt 0 ]; then
  echo "ERROR: Found $CRITICAL_ISSUES critical security issues"
  jq '.results | map(select(.severity == "ERROR"))' semgrep-results.json
  exit 1
else
  echo "No critical security issues found"
fi
```

#### Dependency Scanning
```bash
#!/bin/bash
# scripts/dependency-scan.sh

echo "Scanning dependencies for vulnerabilities..."

# NPM audit
npm audit --audit-level moderate --json > npm-audit.json

# Проверка критичных уязвимостей
CRITICAL_VULNS=$(jq '.metadata.vulnerabilities.critical' npm-audit.json)

if [ $CRITICAL_VULNS -gt 0 ]; then
  echo "ERROR: $CRITICAL_VULNS critical vulnerabilities found in dependencies"
  exit 1
else
  echo "No critical vulnerabilities found in dependencies"
fi

# Обновление устаревших пакетов
npm outdated --json > outdated-packages.json
```

### Infrastructure Security Scanning

#### Docker Image Scanning
```bash
#!/bin/bash
# scripts/docker-scan.sh

echo "Scanning Docker image for vulnerabilities..."

# Использование Trivy для сканирования образов
trivy image --severity HIGH,CRITICAL --format json vball-aggregator:latest > docker-scan.json

# Проверка критичных уязвимостей
CRITICAL_VULNS=$(jq '.Results[0].Vulnerabilities | map(select(.Severity == "CRITICAL")) | length' docker-scan.json)

if [ $CRITICAL_VULNS -gt 0 ]; then
  echo "ERROR: $CRITICAL_VULNS critical vulnerabilities found in Docker image"
  jq '.Results[0].Vulnerabilities | map(select(.Severity == "CRITICAL"))' docker-scan.json
  exit 1
else
  echo "No critical vulnerabilities found in Docker image"
fi
```

#### Infrastructure Scanning
```bash
#!/bin/bash
# scripts/infra-scan.sh

echo "Scanning infrastructure configuration..."

# Проверка безопасности Docker контейнеров
docker run --rm -v /var/run/docker.sock:/var/run/docker.sock \
  -v $(pwd):/workspace \
  aquasec/trivy fs /workspace

# Проверка конфигурации Nginx
nginx -t && echo "Nginx configuration is valid"

# Проверка SSL сертификатов
ssl_expiry=$(openssl x509 -in /etc/letsencrypt/live/your-domain.com/fullchain.pem -noout -dates | grep notAfter | cut -d= -f2)
ssl_timestamp=$(date -d "$ssl_expiry" +%s)
current_timestamp=$(date +%s)
days_until_expiry=$(( (ssl_timestamp - current_timestamp) / 86400 ))

if [ $days_until_expiry -lt 30 ]; then
  echo "WARNING: SSL certificate expires in $days_until_expiry days"
fi
```

## Мониторинг безопасности

### SIEM (Security Information and Event Management)

#### Сбор логов безопасности
```bash
#!/bin/bash
# scripts/setup-siem-monitoring.sh

# Настройка Filebeat для сбора логов
sudo tee /etc/filebeat/filebeat.yml << 'EOF'
filebeat.inputs:
- type: log
  enabled: true
  paths:
    - /var/log/auth.log
    - /var/log/nginx/access.log
    - /var/log/nginx/error.log
    - /opt/vball-aggregator/logs/app.log
  
  fields:
    service: vball-aggregator
    environment: production
    
  multiline.pattern: '^[0-9]{4}-[0-9]{2}-[0-9]{2}'
  multiline.negate: true
  multiline.match: after

output.elasticsearch:
  hosts: ["elasticsearch:9200"]
  index: "vball-security-%{+yyyy.MM.dd}"

setup.template.name: "vball-security"
setup.template.pattern: "vball-security-*"
EOF

sudo systemctl enable filebeat
sudo systemctl start filebeat
```

#### Анализ аномалий
```bash
#!/bin/bash
# scripts/security-anomaly-detection.sh

# Детекция сканирования портов
SCAN_ATTEMPTS=$(grep "Failed password" /var/log/auth.log | grep $(date +%Y-%m-%d) | wc -l)
if [ $SCAN_ATTEMPTS -gt 50 ]; then
  echo "ALERT: Potential port scan detected - $SCAN_ATTEMPTS failed attempts"
fi

# Детекция подозрительного трафика
SUSPICIOUS_REQUESTS=$(grep -i "union\|select\|drop\|insert\|update" /var/log/nginx/access.log | wc -l)
if [ $SUSPICIOUS_REQUESTS -gt 10 ]; then
  echo "ALERT: Potential SQL injection attempts detected"
fi

# Проверка необычных HTTP методов
UNUSUAL_METHODS=$(grep -E "TRACE|TRACK|CONNECT" /var/log/nginx/access.log | wc -l)
if [ $UNUSUAL_METHODS -gt 0 ]; then
  echo "ALERT: Unusual HTTP methods detected"
fi
```

## План реагирования на инциденты

### Процедуры реагирования

#### Уровень 1: Низкий приоритет
**Примеры**: Неудачные попытки входа, подозрительные запросы
**Время реагирования**: 4 часа

```bash
# scripts/incident-response-level1.sh
#!/bin/bash

echo "=== LEVEL 1 INCIDENT RESPONSE ==="
echo "Timestamp: $(date)"
echo "Incident Type: Failed login attempts"

# Анализ инцидента
FAILED_LOGINS=$(grep "Failed password" /var/log/auth.log | tail -20)
echo "Recent failed login attempts:"
echo "$FAILED_LOGINS"

# Проверка источника атак
ATTACKING_IPS=$(echo "$FAILED_LOGINS" | awk '{print $11}' | sort | uniq -c | sort -nr | head -5)
echo "Top attacking IPs:"
echo "$ATTACKING_IPS"

# Блокировка атакующих IP
echo "$ATTACKING_IPS" | while read count ip; do
  if [ $count -gt 10 ]; then
    echo "Blocking IP $ip due to $count failed attempts"
    sudo ufw deny from $ip
  fi
done

# Уведомление команды
echo "Incident logged and basic mitigation applied"
```

#### Уровень 2: Средний приоритет  
**Примеры**: Успешная компрометация, вирусы, несанкционированный доступ
**Время реагирования**: 1 час

```bash
# scripts/incident-response-level2.sh
#!/bin/bash

echo "=== LEVEL 2 INCIDENT RESPONSE ==="
echo "Timestamp: $(date)"
echo "Incident Type: Potential security breach"

# Немедленные действия
echo "1. Isolating affected systems..."

# Блокировка всех подозрительных подключений
sudo ufw default deny incoming
sudo ufw allow from YOUR_ADMIN_IP to any port 22

# Сохранение доказательств
EVIDENCE_DIR="/var/log/security-incidents/$(date +%Y%m%d_%H%M%S)"
sudo mkdir -p "$EVIDENCE_DIR"

# Сохранение логов
sudo cp /var/log/auth.log "$EVIDENCE_DIR/"
sudo cp /var/log/nginx/access.log "$EVIDENCE_DIR/"
sudo cp /var/log/nginx/error.log "$EVIDENCE_DIR/"

# Создание снапшота системы
sudo dd if=/dev/sda of="$EVIDENCE_DIR/disk-snapshot.img" bs=4M count=1000

echo "2. Evidence preserved in $EVIDENCE_DIR"

# Уведомление команды безопасности
send_security_alert "LEVEL_2" "Potential security breach detected"

echo "3. Security team notified"
```

#### Уровень 3: Критический приоритет
**Примеры**: Полная компрометация системы, потеря данных
**Время реагирования**: 15 минут

```bash
# scripts/incident-response-level3.sh
#!/bin/bash

echo "=== LEVEL 3 CRITICAL INCIDENT RESPONSE ==="
echo "Timestamp: $(date)"
echo "Incident Type: CRITICAL SECURITY BREACH"

# Немедленная изоляция
echo "1. IMMEDIATE CONTAINMENT"
sudo systemctl stop nginx
sudo iptables -F
sudo iptables -P INPUT DROP
sudo iptables -P FORWARD DROP
sudo iptables -P OUTPUT DROP

# Аварийное отключение всех сервисов
docker-compose -f docker-compose.prod.yml down

# Сохранение критичных данных
CRITICAL_BACKUP_DIR="/opt/emergency-backup/$(date +%Y%m%d_%H%M%S)"
mkdir -p "$CRITICAL_BACKUP_DIR"

# Аварийный бэкап БД
docker-compose exec -T db pg_dumpall -U postgres > "$CRITICAL_BACKUP_DIR/emergency-database.sql"

# Уведомление всех заинтересованных сторон
send_emergency_alert "CRITICAL" "Complete system isolation initiated"

echo "2. System isolated - CRITICAL BACKUP CREATED"

# Уведомление внешних органов (если требуется)
echo "3. Preparing compliance notifications..."
echo "GDPR Article 33 notification required within 72 hours"

echo "4. Executive team notification sent"
```

### Постинцидентный анализ

#### Root Cause Analysis
```bash
#!/bin/bash
# scripts/post-incident-analysis.sh

INCIDENT_ID=$1
ANALYSIS_DIR="/var/log/incident-analysis/$INCIDENT_ID"

mkdir -p "$ANALYSIS_DIR"

echo "=== INCIDENT ANALYSIS REPORT ===" > "$ANALYSIS_DIR/analysis.md"
echo "Incident ID: $INCIDENT_ID" >> "$ANALYSIS_DIR/analysis.md"
echo "Analysis Date: $(date)" >> "$ANALYSIS_DIR/analysis.md"
echo "" >> "$ANALYSIS_DIR/analysis.md"

# Timeline analysis
echo "## Timeline Analysis" >> "$ANALYSIS_DIR/analysis.md"
grep -E "$(date +%Y-%m-%d).*error\|$(date +%Y-%m-%d).*fail\|$(date +%Y-%m-%d).*breach" /var/log/*.log > "$ANALYSIS_DIR/timeline.log"

# Log analysis
echo "## Log Analysis" >> "$ANALYSIS_DIR/analysis.md"
echo "Failed authentication attempts:" >> "$ANALYSIS_DIR/analysis.md"
grep "Failed password" /var/log/auth.log | wc -l >> "$ANALYSIS_DIR/analysis.md"

echo "Suspicious requests:" >> "$ANALYSIS_DIR/analysis.md"
grep -E "union|select|drop|insert|update" /var/log/nginx/access.log | wc -l >> "$ANALYSIS_DIR/analysis.md"

# System state analysis
echo "## System State Analysis" >> "$ANALYSIS_DIR/analysis.md"
echo "Active connections:" >> "$ANALYSIS_DIR/analysis.md"
netstat -an | grep ESTABLISHED | wc -l >> "$ANALYSIS_DIR/analysis.md"

echo "Running processes:" >> "$ANALYSIS_DIR/analysis.md"
ps aux > "$ANALYSIS_DIR/processes.txt"

echo "## Recommendations" >> "$ANALYSIS_DIR/analysis.md"
echo "1. Review and update security policies" >> "$ANALYSIS_DIR/analysis.md"
echo "2. Implement additional monitoring" >> "$ANALYSIS_DIR/analysis.md"
echo "3. Conduct security training" >> "$ANALYSIS_DIR/analysis.md"
echo "4. Update incident response procedures" >> "$ANALYSIS_DIR/analysis.md"

echo "Analysis complete: $ANALYSIS_DIR/analysis.md"
```

## Регулярные проверки безопасности

### Еженедельный security audit
```bash
#!/bin/bash
# scripts/weekly-security-audit.sh

echo "=== WEEKLY SECURITY AUDIT $(date) ==="

# Проверка обновлений системы
echo "1. System Updates:"
apt list --upgradable 2>/dev/null | grep -v WARNING

# Проверка слабых паролей пользователей
echo "2. User Password Audit:"
awk -F: '$2 != "!" {print $1}' /etc/shadow

# Проверка SUID/SGID файлов
echo "3. SUID/SGID Files:"
find / -perm /6000 -type f 2>/dev/null | head -20

# Проверка открытых портов
echo "4. Open Ports:"
netstat -tuln

# Проверка логов на предмет аномалий
echo "5. Log Analysis:"
echo "Failed logins today: $(grep $(date +%Y-%m-%d) /var/log/auth.log | grep Failed | wc -l)"
echo "Suspicious requests today: $(grep $(date +%Y-%m-%d) /var/log/nginx/access.log | grep -E 'union|select|drop' | wc -l)"

# Проверка SSL сертификатов
echo "6. SSL Certificate Status:"
echo "Days until expiration: $(openssl x509 -in /etc/letsencrypt/live/your-domain.com/fullchain.pem -noout -enddate | cut -d= -f2 | xargs -I {} date -d {} +%s | xargs -I {} echo "($(date +%s) - {}) / 86400" | bc)"

echo "Weekly audit completed"
```

### Месячный security review
```bash
#!/bin/bash
# scripts/monthly-security-review.sh

REPORT_FILE="/var/log/security-reviews/monthly-$(date +%Y-%m).md"

mkdir -p "/var/log/security-reviews"

cat > "$REPORT_FILE" << 'EOF'
# Monthly Security Review Report

## Executive Summary
This report covers security metrics and incidents for the past month.

## Security Metrics
- Total security events: 
- Blocked attacks: 
- Failed login attempts: 
- Vulnerabilities found: 
- Incidents resolved: 

## Incident Summary
[Details of any security incidents]

## Vulnerability Assessment
[Details of vulnerability scans and remediation]

## Recommendations
1. [Security recommendations]
2. [Process improvements]
3. [Training needs]

## Next Month Priorities
[Priorities for the next month]
EOF

echo "Monthly security review report generated: $REPORT_FILE"
```

## Соответствие требованиям

### GDPR Compliance
```markdown
## GDPR Security Measures

### Article 25 - Data Protection by Design and by Default
- ✅ Encryption at rest and in transit
- ✅ Pseudonymization of user data
- ✅ Minimization of data collection
- ✅ Regular data deletion procedures

### Article 32 - Security of Processing
- ✅ Encryption of personal data
- ✅ Ongoing confidentiality, integrity, availability
- ✅ Ability to restore personal data
- ✅ Regular testing and evaluation of measures

### Article 33 - Breach Notification
- 72-hour notification procedure ready
- Breach detection system in place
- Incident response team defined
```

### ISO 27001 Controls Implementation
```markdown
## ISO 27001 Annex A Implementation

### A.9 - Access Control
- ✅ A.9.1.1 - Access control policy
- ✅ A.9.2.1 - User registration and de-registration
- ✅ A.9.2.3 - Management of privileged access rights
- ✅ A.9.4.1 - Information access restriction

### A.12 - Operations Security  
- ✅ A.12.1.1 - Documented operating procedures
- ✅ A.12.6.1 - Management of technical vulnerabilities
- ✅ A.12.7.1 - Information systems audit considerations

### A.13 - Communications Security
- ✅ A.13.1.1 - Network controls
- ✅ A.13.2.1 - Information transfer policies
- ✅ A.13.2.3 - Confidentiality or non-disclosure agreements
```

---

**Безопасность является критически важным аспектом VBallAgregator. Всегда следуйте этим рекомендациям и регулярно обновляйте меры безопасности в соответствии с новыми угрозами.**

**Последнее обновление**: 2025-11-24  
**Версия**: 1.0.0

### Безопасность Telegram Webhook

#### Проверка подписи webhook
```typescript
// src/shared/webhook-security.ts
import crypto from 'crypto';

export function verifyTelegramWebhook(data: string, signature: string, botToken: string): boolean {
  const secretKey = crypto.createHmac('sha256', 'WebHookData').update(botToken).digest();
  const expectedSignature = crypto.createHmac('sha256', secretKey).update(data).digest('hex');
  
  return crypto.timingSafeEqual(
    Buffer.from(signature, 'hex'),
    Buffer.from(expectedSignature, 'hex')
  );
}

// Использование в webhook обработчике
app.post('/webhook', (req, res) => {
  const signature = req.headers['x-telegram-bot-api-secret-token'] as string;
  const data = JSON.stringify(req.body);
  
  if (!verifyTelegramWebhook(data, signature, config.telegram.botToken)) {
    logger.warn('Invalid webhook signature', { ip: req.ip });
    return res.status(401).send('Unauthorized');
  }
  
  // Обработка webhook...
});
```

#### Настройка безопасного webhook URL
```bash
# Генерация секретного токена для webhook
WEBHOOK_SECRET=$(openssl rand -hex 32)

# Установка webhook с секретом
curl -X POST "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/setWebhook" \
     -H "Content-Type: application/json" \
     -d "{
       \"url\": \"https://your-domain.com/webhook\",
       \"secret_token\": \"$WEBHOOK_SECRET\"
     }"

# Проверка настройки
curl "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getWebhookInfo"
```

### SSL/TLS конфигурация

#### Строгая конфигурация Nginx
```nginx
# /etc/nginx/sites-available/vball-aggregator
server {
    listen 80;
    server_name your-domain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name your-domain.com;

    # SSL сертификаты
    ssl_certificate /etc/letsencrypt/live/your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;

    # Строгие SSL настройки
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512:ECDHE-RSA-AES256-GCM-SHA384:DHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 1d;

    # HSTS
    add_header Strict-Transport-Security "max-age=63072000" always;

    # Защита от clickjacking
    add_header X-Frame-Options DENY always;

    # XSS protection
    add_header X-XSS-Protection "1; mode=block" always;

    # Content type sniffing protection
    add_header X-Content-Type-Options nosniff always;

    # Referrer policy
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    # CSP header (настройте под ваши нужды)
    add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline';" always;

    # Проксирование
    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # Дополнительные заголовки безопасности
        proxy_set_header X-Content-Type-Options nosniff;
        proxy_set_header X-Frame-Options DENY;
        proxy_set_header X-XSS-Protection "1; mode=block";
    }
}
```

### Безопасность базы данных

#### Настройка PostgreSQL
```bash
# Редактирование конфигурации
sudo nano /etc/postgresql/13/main/postgresql.conf

# Критичные настройки безопасности:
ssl = on                              # Включить SSL
ssl_cert_file = 'server.crt'         # Сертификат сервера
ssl_key_file = 'server.key'          # Приватный ключ
password_encryption = scram-sha-256   # Современный алгоритм хеширования

# Ограничение подключений
max_connections = 50
superuser_reserved_connections = 3

# Логирование
log_connections = on
log_disconnections = on
log_statement = 'all'                # Логировать все SQL

sudo systemctl restart postgresql
```

#### Создание безопасного пользователя БД
```sql
-- Подключение как суперпользователь
sudo -u postgres psql

-- Создание пользователя с ограниченными правами
CREATE USER vball_app WITH PASSWORD 'very_secure_password_32_chars_min';

-- Создание базы данных
CREATE DATABASE vball_prod OWNER vball_app;

-- Подключение к базе
\c vball_prod;

-- Предоставление только необходимых прав
GRANT CONNECT ON DATABASE vball_prod TO vball_app;
GRANT USAGE ON SCHEMA public TO vball_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO vball_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO vball_app;

-- Запрет на опасные операции
REVOKE ALL ON DATABASE vball_prod FROM PUBLIC;
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM PUBLIC;
```

### Система обнаружения вторжений

#### Установка Fail2Ban
```bash
# Установка
sudo apt install fail2ban

# Конфигурация для SSH
sudo tee /etc/fail2ban/jail.local << EOF
[DEFAULT]
bantime = 3600
findtime = 600
maxretry = 3

[sshd]
enabled = true
port = ssh
logpath = /var/log/auth.log
maxretry = 3

[nginx-http-auth]
enabled = true
filter = nginx-http-auth
port = http,https
logpath = /var/log/nginx/error.log

[nginx-noscript]
enabled = true
port = http,https
logpath = /var/log/nginx/access.log
maxretry = 6
EOF

# Перезапуск
sudo systemctl restart fail2ban
sudo systemctl enable fail2ban

# Проверка статуса
sudo fail2ban-client status
sudo fail2ban-client status sshd
```

### Мониторинг безопасности

#### Логирование безопасности
```yaml
# docker-compose.prod.yml с расширенным логированием
version: '3.8'
services:
  app:
    logging:
      driver: "json-file"
      options:
        max-size: "100m"
        max-file: "10"
    environment:
      - LOG_LEVEL=info
      - SECURITY_LOGGING=enabled
```

#### Алерты безопасности
```bash
# Скрипт мониторинга подозрительной активности
cat > security-monitor.sh << 'EOF'
#!/bin/bash

# Проверка неудачных попыток входа SSH
FAILED_SSH=$(grep "Failed password" /var/log/auth.log | wc -l)
if [ $FAILED_SSH -gt 10 ]; then
    echo "ALERT: High number of SSH failures: $FAILED_SSH" | mail -s "Security Alert" admin@domain.com
fi

# Проверка новых пользователей в системе
NEW_USERS=$(last | grep "new users" | wc -l)
if [ $NEW_USERS -gt 0 ]; then
    echo "INFO: New user logins detected" | mail -s "User Activity" admin@domain.com
fi

# Проверка использования диска
DISK_USAGE=$(df / | awk 'NR==2 {print $5}' | sed 's/%//')
if [ $DISK_USAGE -gt 90 ]; then
    echo "ALERT: Disk usage critical: ${DISK_USAGE}%" | mail -s "Disk Space Alert" admin@domain.com
fi
EOF

chmod +x security-monitor.sh

# Добавление в crontab для выполнения каждые 5 минут
(crontab -l 2>/dev/null; echo "*/5 * * * * /opt/vball-aggregator/security-monitor.sh") | crontab -
```

## Мониторинг и логирование

### Настройка логирования

#### Структурированные логи
```yaml
# docker-compose.prod.yml
version: '3.8'
services:
  app:
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"
```

#### Централизованное логирование с ELK
```yaml
# docker-compose.logging.yml
version: '3.8'
services:
  elasticsearch:
    image: elasticsearch:7.17.0
    environment:
      - discovery.type=single-node
    volumes:
      - elasticsearch_data:/usr/share/elasticsearch/data

  logstash:
    image: logstash:7.17.0
    volumes:
      - ./logstash.conf:/usr/share/logstash/pipeline/logstash.conf
    depends_on:
      - elasticsearch

  kibana:
    image: kibana:7.17.0
    ports:
      - "5601:5601"
    depends_on:
      - elasticsearch

volumes:
  elasticsearch_data:
```

### Мониторинг производительности

#### Настройка Prometheus и Grafana
```yaml
# docker-compose.monitoring.yml
version: '3.8'
services:
  prometheus:
    image: prom/prometheus
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml
    ports:
      - "9090:9090"

  grafana:
    image: grafana/grafana
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=admin
    ports:
      - "3001:3000"
    volumes:
      - grafana_data:/var/lib/grafana

volumes:
  grafana_data:
```

### Алертинг
```yaml
# alertmanager.yml
global:
  smtp_smarthost: 'localhost:587'
  smtp_from: 'alerts@your-domain.com'

route:
  group_by: ['alertname']
  group_wait: 10s
  group_interval: 10s
  repeat_interval: 1h
  receiver: 'web.hook'

receivers:
- name: 'web.hook'
  webhook_configs:
  - url: 'http://localhost:5001/'
```

## Резервное копирование

### Стратегия резервного копирования

#### Что резервировать
- База данных PostgreSQL
- Загруженные пользователем файлы
- Конфигурационные файлы
- SSL сертификаты
- Переменные окружения

#### Частота резервного копирования
- **База данных**: Ежедневно в 2:00
- **Файлы**: Еженедельно
- **Конфигурация**: При каждом изменении
- **SSL сертификаты**: Еженедельно

### Полное резервное копирование
```bash
# Создание полного бэкапа
cat > full-backup.sh << 'EOF'
#!/bin/bash

BACKUP_DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/opt/backups/full_$BACKUP_DATE"

mkdir -p $BACKUP_DIR

# Резервное копирование базы данных
/opt/vball-aggregator/backup-db.sh

# Резервное копирование файлов
docker cp $(docker-compose ps -q app):/app/uploads $BACKUP_DIR/

# Резервное копирование конфигурации
cp -r /opt/vball-aggregator/.env* $BACKUP_DIR/
cp -r /etc/nginx/sites-available $BACKUP_DIR/nginx/
cp -r /etc/letsencrypt $BACKUP_DIR/ssl/

# Создание архива
tar -czf "$BACKUP_DIR.tar.gz" -C $BACKUP_DIR .

# Очистка
rm -rf $BACKUP_DIR

echo "Full backup created: $BACKUP_DIR.tar.gz"
EOF

chmod +x full-backup.sh
```

### Восстановление после сбоя

#### Восстановление полной системы
```bash
# Остановка всех сервисов
docker-compose down

# Восстановление из архива
tar -xzf backup_full_20231124_020000.tar.gz -C /tmp/restore/
cd /tmp/restore

# Восстановление базы данных
gunzip -c backup_vball_db_backup_20231124_020000.sql.gz | docker-compose exec -T db psql -U postgres vball_db

# Восстановление файлов
docker cp uploads/ $(docker-compose ps -q app):/app/

# Восстановление конфигурации
cp .env* /opt/vball-aggregator/
cp -r nginx/* /etc/nginx/sites-available/
cp -r ssl/* /etc/letsencrypt/

# Перезапуск сервисов
cd /opt/vball-aggregator
docker-compose up -d
```

## Обновление системы

### Обновление приложения

#### Blue-Green развертывание
```bash
# Подготовка нового окружения
docker-compose -f docker-compose.new.yml up -d

# Проверка новой версии
curl -f http://localhost:3001/health

# Переключение трафика
sudo nginx -t && sudo systemctl reload nginx

# Остановка старого окружения
docker-compose down
```

#### Rolling обновление
```bash
# Обновление образов
docker-compose pull
docker-compose up -d

# Обновление базы данных
docker-compose exec app npx prisma migrate deploy

# Проверка состояния
docker-compose ps
```

### Обновление базы данных
```bash
# Создание бэкапа перед обновлением
./backup-db.sh

# Выполнение миграций
docker-compose exec app npx prisma migrate deploy

# Проверка целостности данных
docker-compose exec app npx prisma db pull
docker-compose exec app npx prisma generate
```

### Мониторинг обновлений
```bash
# Проверка логов после обновления
docker-compose logs -f app

# Проверка метрик
curl http://localhost:9090/api/v1/query?query=up

# Проверка доступности бота
curl -X POST https://your-domain.com/webhook \
  -H "Content-Type: application/json" \
  -d '{"update_id": 12345}'
```

### План отката
```bash
# Скрипт быстрого отката
cat > rollback.sh << 'EOF'
#!/bin/bash

echo "Starting rollback process..."

# Остановка текущей версии
docker-compose down

# Восстановление предыдущей версии
docker-compose -f docker-compose.prev.yml up -d

# Восстановление базы данных (если нужно)
echo "Restore database from backup? (y/n)"
read -r RESTORE_DB

if [ "$RESTORE_DB" = "y" ]; then
    echo "Latest backup file:"
    ls -t /opt/backups/vball_db_backup_*.sql.gz | head -1
    echo "Restore this backup? (y/n)"
    read -r CONFIRM
    if [ "$CONFIRM" = "y" ]; then
        LATEST_BACKUP=$(ls -t /opt/backups/vball_db_backup_*.sql.gz | head -1)
        gunzip -c $LATEST_BACKUP | docker-compose exec -T db psql -U postgres vball_db
    fi
fi

echo "Rollback completed"
EOF

chmod +x rollback.sh
```

---

## Проверка развертывания

### Финальная проверка
```bash
# Проверка всех сервисов
docker-compose ps

# Проверка доступности API
curl -f http://your-domain.com/health

# Проверка базы данных
docker-compose exec app npx prisma db push --accept-data-loss

# Проверка логов
docker-compose logs --tail=50 app

# Тестирование бота
curl -X POST https://your-domain.com/webhook \
  -H "Content-Type: application/json" \
  -d '{"message": {"message_id": 1, "from": {"id": 123}, "chat": {"id": 123}, "text": "/start"}}'
```

### Мониторинг после развертывания
- Настройте мониторинг в Grafana
- Проверьте работу алертов
- Мониторьте логи в течение первых 24 часов
- Проверьте производительность базы данных

---

**Последнее обновление**: 2025-11-24  
**Версия**: 1.0.0