# ADR-003: Улучшение системы уведомлений (Фаза 3)

## Статус
**ПРЕДЛОЖЕНО** | Дата: 2025-11-04

## Контекст и постановка проблемы

После реализации третьей фазы (система оплат) выявлены критические проблемы в архитектуре уведомлений:

### 🚨 Текущие проблемы
1. **Производительность**: Массовые напоминания могут привести к блокировке Telegram API
2. **Дублирование**: Нет защиты от повторных уведомлений одному пользователю
3. **User Experience**: Отсутствует механизм отписки от уведомлений
4. **Compliance**: Нарушение принципа "согласия пользователя" для массовых рассылок

### 📊 Анализ кода
- [`NotificationService.sendBatch()`](../../../src/shared/notification-service.ts:26): только 100ms между батчами
- [`sendPaymentReminders()`](../../../src/application/use-cases.ts:163): нет глобального лимита
- [`handleSendPaymentReminders()`](../../../src/infrastructure/event-setup.ts:300): отсутствует идемпотентность
- Нет проверки пользовательских предпочтений во всех обработчиках событий

## Рассмотренные варианты

### Вариант A: Минимальные улучшения
**Состав**: Только rate limiting в существующем `NotificationService`
- ✅ **Плюсы**: Быстрая реализация (1-2 дня), минимальные изменения
- ❌ **Минусы**: Не решает проблему дублирования и отписки
- ⚠️ **Риски**: Частичное решение, технический долг

### Вариант B: Comprehensive Solution (Рекомендуемый)
**Состав**: Rate limiting + Idempotency + User Preferences
- ✅ **Плюсы**: Полное решение всех проблем, современная архитектура
- ✅ **Плюсы**: GDPR-compliant, улучшенный UX
- ❌ **Минусы**: Больше времени на реализацию (7-8 дней)
- ⚠️ **Риски**: Schema changes, Redis dependency

### Вариант C: Внешний сервис уведомлений
**Состав**: Integration с Twilio/SendGrid/etc.
- ✅ **Плюсы**: Professional features out-of-box
- ❌ **Минусы**: Высокая стоимость, vendor lock-in
- ❌ **Минусы**: Overkill для MVP

## Решение и обоснование

**Выбран Вариант B: Comprehensive Solution**

### Архитектурные компоненты

#### 1. **Redis-based Rate Limiter**
```typescript
interface RateLimiterService {
  checkQuota(key: string, limit: number, window: number): Promise<boolean>;
  consumeQuota(key: string, tokens: number): Promise<void>;
}
```
- **Обоснование**: Distributed rate limiting для multiple instances
- **Лимиты**: 30 сообщений/минуту (Telegram API limit)

#### 2. **Idempotency Service**
```typescript
class NotificationIdempotencyService {
  ensureNotSentRecently(userId: string, gameId: string, type: string, cooldown: number): Promise<boolean>
}
```
- **Обоснование**: Предотвращение дублей при restart/retry
- **TTL**: 1 час для payment reminders, 30 минут для game reminders

#### 3. **User Preferences System**
```sql
CREATE TABLE user_notification_preferences (
  user_id UUID PRIMARY KEY,
  global_notifications BOOLEAN DEFAULT true,
  payment_reminders_auto BOOLEAN DEFAULT true,
  payment_reminders_manual BOOLEAN DEFAULT true,
  -- ... другие типы
);
```
- **Обоснование**: GDPR compliance + UX improvement
- **Default**: Все включено для backward compatibility

#### 4. **Enhanced NotificationService**
```typescript
class EnhancedNotificationService {
  async sendNotification(req: NotificationRequest): Promise<boolean> {
    // 1. Check preferences → 2. Check idempotency → 3. Rate limit → 4. Send
  }
}
```

### Интеграция с существующим кодом

| Компонент | Требуемые изменения | Обратная совместимость |
|-----------|-------------------|-----------------------|
| [`event-setup.ts`](../../../src/infrastructure/event-setup.ts) | Добавить проверки preferences | ✅ Да |
| [`notification-service.ts`](../../../src/shared/notification-service.ts) | Wrap в EnhancedNotificationService | ✅ Да |  
| [`command-handlers.ts`](../../../src/bot/command-handlers.ts) | Добавить `/settings` команды | ✅ Да |
| Database schema | Новая таблица + migration | ✅ Да |

## Последствия

### ✅ Положительные
1. **Performance**: Исключение блокировок Telegram API
2. **User Experience**: Контроль над уведомлениями
3. **Reliability**: Нет дублирования уведомлений  
4. **Compliance**: GDPR-ready архитектура
5. **Monitoring**: Детальная аналитика отправок

### ⚠️ Отрицательные  
1. **Complexity**: Добавляется 3 новых сервиса
2. **Dependencies**: Redis становится критичным
3. **Storage**: +1 таблица в БД
4. **Migration effort**: Нужна миграция существующих пользователей

### 🎯 Метрики успеха
- **API errors**: Telegram rate limit errors → 0
- **User complaints**: Дублирующие уведомления → 0  
- **Opt-out rate**: < 5% пользователей отключают все уведомления
- **Delivery rate**: > 95% успешных доставок

## Implementation Plan

### Фаза 1: Core Infrastructure (3 дня)
```
День 1: Redis Rate Limiter
День 2: Idempotency Service  
День 3: Integration tests
```

### Фаза 2: User Preferences (4 дня)
```
День 4: Database schema + migration
День 5: UserPreferencesService
День 6: Bot commands (/settings)
День 7: UI testing
```

### Фаза 3: Integration & Monitoring (1 день)
```
День 8: EnhancedNotificationService + metrics
```

## Технические детали

### Graceful Degradation
```typescript
// Fail-open при недоступности Redis
async isAllowed(userId: string, type: string): Promise<boolean> {
  try {
    return await this.preferences.isAllowed(userId, type);
  } catch (error) {
    logger.warn('Preferences service unavailable, defaulting to allow');
    return true; // Критичные уведомления должны доходить
  }
}
```

### Monitoring
- **Grafana dashboard**: Rate limit usage, opt-out trends
- **Alerts**: Redis down, high error rate
- **Logs**: Detailed notification tracking for debugging

### Rollback Strategy
1. Feature flags для включения/отключения новых проверок
2. Graceful degradation при недоступности зависимостей  
3. Откат миграции через revert script

## Связанные решения
- [ADR-001: Event-driven Architecture](../Phase_2/ARCHITECTURE_REVIEW_ADR.md)
- [ADR-002: Domain Model Design](../Phase_1/REVIEW_SUMMARY.md)

## Следующие шаги
1. **Создать задачи** в backlog с детальными requirements
2. **Подготовить Redis** в staging/production environment  
3. **Написать migration scripts** для user preferences
4. **Настроить monitoring** для Telegram API rate limits

---

**Принятие решения**: Требует одобрения команды  
**Ответственные**: Backend team + DevOps для Redis setup  
**Дедлайн**: Реализация в течение 1.5 недель после одобрения