# ADR: Улучшение слоя репозиториев (Repositories Layer Enhancement)

## Контекст

Текущий слой репозиториев в `src/infrastructure/repositories.ts` имеет несколько архитектурных проблем:

### Выявленные проблемы

1. **Непоследовательное логирование**
   - Только `PrismaUserRepo` использует `LoggerFactory.repository()`
   - `PrismaGameRepo` и `PrismaRegistrationRepo` не логируют операции
   - Отсутствует мониторинг производительности БД операций

2. **Отсутствие валидации данных**
   - Нет проверки входных параметров в методах
   - Отсутствует защита от `null`/`undefined` значений
   - Нет валидации бизнес-правил на уровне репозитория

3. **Проблемы с типизацией**
   - Использование `as any` в методе `updatePriorityWindow` (строка 95)
   - Отсутствует строгая типизация результатов запросов

4. **Дублирование кода**
   - Повторяющаяся логика маппинга Prisma → Domain объекты
   - Схожая структура transaction методов во всех репозиториях

5. **Нарушение принципа единственной ответственности**
   - Метод `getOrganizerByUserId` в `GameRepo` не относится к работе с играми
   - Смешение различных доменных концепций

6. **Недостаточная обработка ошибок**
   - Примитивная обработка ошибок без контекста
   - Отсутствует логирование неудачных операций

## Решение

### Предлагаемые улучшения

1. **Разделение на отдельные модули**
   ```
   src/infrastructure/repositories/
   ├── index.ts                    # Экспорты всех интерфейсов и реализаций
   ├── game-repository.ts          # GameRepo интерфейс + PrismaGameRepo
   ├── registration-repository.ts  # RegistrationRepo интерфейс + PrismaRegistrationRepo
   ├── user-repository.ts          # UserRepo интерфейс + PrismaUserRepo
   ├── organizer-repository.ts     # OrganizerRepo интерфейс + PrismaOrganizerRepo (новый)
   └── base-repository.ts          # Базовый класс с общими методами
   ```

2. **Единообразное логирование**
   ```typescript
   // Добавить во все репозитории
   private logger = LoggerFactory.repository('prisma-game-repo');

   async findById(id: string): Promise<Game | null> {
     this.logger.database('findById', 'games', 'SELECT', { id });
     // ... операция
     this.logger.info('findById', 'Game fetched successfully', { gameId: id });
   }
   ```

3. **Валидация входных данных**
   ```typescript
   import { InputValidator } from '../shared/input-validator.js';

   async findById(id: string): Promise<Game | null> {
     InputValidator.validateRequired(id, 'id');
     // ...
   }
   ```

4. **Базовый класс для устранения дублирования**
   ```typescript
   // base-repository.ts
   export abstract class BasePrismaRepository {
     protected logger: Logger;

     constructor(component: string) {
       this.logger = LoggerFactory.repository(component);
     }

     protected async executeWithLogging<T>(
       operation: string,
       table: string,
       action: string,
       params: any,
       fn: () => Promise<T>
     ): Promise<T> {
       this.logger.database(operation, table, action, params);
       try {
         const result = await fn();
         this.logger.info(operation, `${action} completed successfully`, params);
         return result;
       } catch (error) {
         this.logger.error(operation, `Failed to ${action.toLowerCase()}`, error as Error, params);
         throw error;
       }
     }
   }
   ```

5. **Извлечение чужеродного метода**
   ```typescript
   // organizer-repository.ts
   export interface OrganizerRepo {
     findByUserId(userId: string): Promise<Organizer | null>;
   }

   export class PrismaOrganizerRepo extends BasePrismaRepository implements OrganizerRepo {
     async findByUserId(userId: string): Promise<Organizer | null> {
       return this.executeWithLogging('findByUserId', 'organizers', 'SELECT', { userId },
         () => prisma.organizer.findUnique({ where: { userId } })
       );
     }
   }
   ```

6. **Улучшенная обработка ошибок**
   ```typescript
   // Создать типизированные исключения
   export class RepositoryError extends Error {
     constructor(message: string, public cause?: Error, public context?: any) {
       super(message);
       this.name = 'RepositoryError';
     }
   }
   ```

## Последствия

### Позитивные
- **Улучшенная наблюдаемость**: Полное логирование всех БД операций с метриками производительности
- **Повышенная надежность**: Валидация данных предотвращает некорректные операции
- **Снижение дублирования**: Helper методы уменьшают объем кода
- **Лучшая архитектура**: Соблюдение SOLID принципов через разделение на модули
- **Упрощение отладки**: Детальное логирование ошибок с контекстом
- **Улучшенная поддерживаемость**: Каждый репозиторий в отдельном файле
- **Легче тестирование**: Изоляция компонентов для unit-тестов

### Негативные
- **Увеличение количества файлов**: Разделение на 6+ файлов вместо одного
- **Снижение производительности**: Дополнительные проверки и логирование
- **Необходимость миграции**: Обновление импортов и существующих тестов
- **Сложность**: Увеличение сложности простых операций
- **Время на рефакторинг**: Значительные изменения в кодовой базе

### Альтернативы
1. **Оставить как есть** - не решает выявленные проблемы
2. **Частичное улучшение** - добавить только логирование, оставить остальные проблемы
3. **Полная перепись** - создать новые репозитории с нуля (слишком затратно)

## Согласование

Этот ADR согласуется с:
- [ARCHITECTURE_OVERVIEW.md](documentation/planning/architecture_overview.md) - принципы Clean Architecture
- [ENHANCED_LOGGING_SYSTEM.md](documentation/enhanced-logging-system.md) - требования к логированию
- [ENHANCED_DOMAIN_ERROR_SYSTEM.md](documentation/enhanced-domain-error-system.md) - типизированные ошибки

## План выполнения

### Фаза 1: Разделение на модули
1. Создать структуру папок `src/infrastructure/repositories/`
2. Разделить `repositories.ts` на отдельные файлы:
   - `base-repository.ts` - базовый класс
   - `game-repository.ts` - GameRepo
   - `registration-repository.ts` - RegistrationRepo
   - `user-repository.ts` - UserRepo
   - `organizer-repository.ts` - OrganizerRepo (новый)
   - `index.ts` - экспорты всех интерфейсов

### Фаза 2: Базовые улучшения
1. Добавить логирование во все репозитории через базовый класс
2. Внедрить валидацию входных данных
3. Создать helper методы для маппинга в базовом классе

### Фаза 3: Архитектурные изменения
1. Извлечь `getOrganizerByUserId` в OrganizerRepository
2. Улучшить обработку ошибок с типизированными исключениями
3. Добавить методы executeWithLogging в базовый класс

### Фаза 4: Тестирование и оптимизация
1. Обновить существующие тесты для новых импортов
2. Добавить тесты для новых функций
3. Оптимизировать производительность логирования
4. Провести интеграционное тестирование

### Критерии готовности
- Все репозитории разделены на отдельные модули
- Логирование работает во всех репозиториях
- Валидация входных данных внедрена
- Нет дублирования кода маппинга
- Все тесты проходят
- Производительность не ухудшилась более чем на 10%

## Статус

**Предложен**

## Дата

2025-11-05

## Ответственный

Команда разработки