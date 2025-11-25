# Справочник API

## Обзор
VBallAgregator API предоставляет минимальный RESTful интерфейс для мониторинга состояния системы. API используется для health checks и базовой диагностики работающего приложения.

## ⚠️ Важное замечание
**Основная функциональность системы реализована через Telegram Bot API**, а не через HTTP REST API. Все операции (создание игр, регистрация, платежи) выполняются через команды бота в Telegram.

## Содержание
- [Базовый URL](#базовый-url)
- [Общие принципы](#общие-принципы)
- [API endpoints](#api-endpoints)
- [Модели данных](#модели-данных)
- [Обработка ошибок](#обработка-ошибок)

## Базовый URL
```
Production: http://localhost:3001
Development: http://localhost:3001
```

## Общие принципы

### Формат ответов
Все ответы возвращаются в JSON формате:
```json
{
  "alive": true,
  "timestamp": "2025-11-24T09:20:00Z"
}
```

### Коды ответов
| Код | Описание | Пример использования |
|-----|----------|---------------------|
| 200 | OK | Успешный health check |
| 503 | Service Unavailable | Система не готова к работе |

## API Endpoints

### Системная информация

#### Получение информации о системе
```http
GET /
```

**Ответ (200 OK):**
```json
{
  "name": "VBallAgregator API",
  "version": "1.0.0",
  "status": "running",
  "timestamp": "2025-11-24T09:20:00Z"
}
```

### Health Checks

#### Основная проверка здоровья системы
```http
GET /health
```

**Ответы:**
- **200 OK** - Система работает нормально или с ограничениями
- **503 Service Unavailable** - Система неработоспособна

**Пример ответа (200 OK):**
```json
{
  "status": "healthy",
  "timestamp": "2025-11-24T09:20:00Z",
  "services": {
    "database": {
      "status": "connected",
      "responseTime": 15
    },
    "redis": {
      "status": "connected", 
      "responseTime": 8
    },
    "telegramBot": {
      "status": "active",
      "responseTime": 45
    }
  }
}
```

#### Проверка готовности системы
```http
GET /health/ready
```

**Используется системами оркестрации** (Docker, Kubernetes) для определения готовности приложения принимать трафик.

**Ответы:**
- **200 OK** - Система готова
- **503 Service Unavailable** - Система не готова

**Пример ответа (200 OK):**
```json
{
  "ready": true,
  "timestamp": "2025-11-24T09:20:00Z"
}
```

#### Проверка жизни системы
```http
GET /health/live
```

**Простая проверка того, что приложение запущено** и не зависло. Используется для liveness probes в Kubernetes.

**Ответ (200 OK):**
```json
{
  "alive": true,
  "timestamp": "2025-11-24T09:20:00Z"
}
```

## Модели данных

### Health Status
```typescript
interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy'
  timestamp: string
  services?: {
    [serviceName: string]: {
      status: 'connected' | 'disconnected' | 'error'
      responseTime?: number
      error?: string
    }
  }
  uptime?: number
  version?: string
}
```

### Service Status
```typescript
interface ServiceStatus {
  status: 'connected' | 'disconnected' | 'error'
  responseTime?: number
  error?: string
}
```

## Обработка ошибок

### Формат ошибки
```json
{
  "status": "unhealthy",
  "timestamp": "2025-11-24T09:20:00Z",
  "error": "Database connection failed",
  "services": {
    "database": {
      "status": "disconnected",
      "error": "Connection timeout"
    }
  }
}
```

### Возможные коды ошибок
| Код | Описание |
|-----|----------|
| `DATABASE_ERROR` | Ошибка подключения к базе данных |
| `REDIS_ERROR` | Ошибка подключения к Redis |
| `TELEGRAM_API_ERROR` | Ошибка Telegram Bot API |
| `CONFIGURATION_ERROR` | Ошибка конфигурации |
| `STARTUP_ERROR` | Ошибка при запуске приложения |

## Мониторинг и метрики

### Время отклика
- **Health endpoints**: < 100ms в нормальных условиях
- **Database queries**: < 500ms для health check
- **Redis operations**: < 50ms для connectivity check

### Частота проверок
Рекомендуется проверять:
- `/health` - каждые 30 секунд
- `/health/ready` - каждые 10 секунд  
- `/health/live` - каждые 5 секунд

## Интеграция с мониторингом

### Docker Healthcheck
```dockerfile
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD curl -f http://localhost:3001/health || exit 1
```

### Kubernetes Probes
```yaml
livenessProbe:
  httpGet:
    path: /health/live
    port: 3001
  initialDelaySeconds: 30
  periodSeconds: 10

readinessProbe:
  httpGet:
    path: /health/ready
    port: 3001
  initialDelaySeconds: 10
  periodSeconds: 5
```

### Prometheus метрики
Приложение готово к интеграции с Prometheus для сбора метрик:
- Время отклика health checks
- Статус внешних сервисов
- Время работы системы
- Количество ошибок

## Ограничения

### Лимиты запросов
- **Общий лимит**: 100 запросов в минуту на IP
- **Health checks**: без ограничений для мониторинга

### Заголовки ответа
```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 99
X-RateLimit-Reset: 1700890800
```

## Безопасность

### Рекомендации
- Размещайте API за reverse proxy (nginx, Traefik)
- Ограничьте доступ к health endpoints из внешней сети
- Используйте HTTPS в production
- Логируйте все запросы к API

### Пример nginx конфигурации
```nginx
location /health {
    proxy_pass http://localhost:3001/health;
    access_log off;  # Отключаем логирование для health checks
    allow 127.0.0.1;
    allow 10.0.0.0/8;
    deny all;
}
```

---

## 📋 Сводка

**Реальное состояние API:** Система предоставляет минимальный API для мониторинга, основная бизнес-логика реализована через Telegram Bot.

**Функциональность:** Только health checks и системная информация.

**Назначение:** Мониторинг состояния приложения, интеграция с системами оркестрации.

**Статус:** ✅ Стабильный и готовый к production использованию.

---

**Последнее обновление**: 2025-11-24  
**Версия API**: 1.0.0  
**Статус**: Актуально ✅