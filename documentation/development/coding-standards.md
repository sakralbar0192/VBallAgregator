# Стандарты кодирования

## Обзор
Данный документ определяет стандарты и рекомендации по написанию кода для проекта VBallAgregator. Соблюдение этих стандартов обеспечивает качество, читаемость и поддерживаемость кода.

## Содержание
- [Общие принципы](#общие-принципы)
- [TypeScript стандарты](#typescript-стандарты)
- [Структура проекта](#структура-проекта)
- [Именование](#именование)
- [Комментарии и документация](#комментарии-и-документация)
- [Обработка ошибок](#обработка-ошибок)
- [Тестирование](#тестирование)
- [Инструменты](#инструменты)

## Общие принципы

### Принципы SOLID
Проект следует принципам SOLID для обеспечения чистой архитектуры:

#### Single Responsibility Principle (SRP)
Каждый класс, модуль или функция должны иметь единственную причину для изменения.

```typescript
// ✅ Правильно: Класс имеет единственную ответственность
export class UserService {
  async createUser(userData: CreateUserDto): Promise<User> {
    const user = User.create(userData)
    return await this.userRepository.save(user)
  }
}

// ❌ Неправильно: Класс выполняет слишком много задач
export class UserService {
  async createUser(userData: CreateUserDto): Promise<User> {
    const user = User.create(userData)
    await this.userRepository.save(user)
    
    // Отправка email - отдельная ответственность
    await this.emailService.sendWelcomeEmail(user)
    
    // Логирование - отдельная ответственность
    await this.logger.logUserCreation(user)
    
    return user
  }
}
```

#### Open/Closed Principle (OCP)
Код должен быть открыт для расширения, но закрыт для модификации.

```typescript
// ✅ Правильно: Использование интерфейсов для расширения
export interface PaymentProcessor {
  processPayment(amount: number, currency: string): Promise<PaymentResult>
}

export class CardPaymentProcessor implements PaymentProcessor {
  async processPayment(amount: number, currency: string): Promise<PaymentResult> {
    // Реализация обработки картой
  }
}

export class CashPaymentProcessor implements PaymentProcessor {
  async processPayment(amount: number, currency: string): Promise<PaymentResult> {
    // Реализация обработки наличных
  }
}
```

### Domain-Driven Design (DDD)
Применение принципов DDD для моделирования бизнес-логики:

- **Сущности (Entities)**: Объекты с уникальной идентичностью
- **Объекты-значения (Value Objects)**: Объекты без идентичности
- **Агрегаты (Aggregates)**: Группы связанных объектов
- **Репозитории (Repositories)**: Абстракция доступа к данным
- **Сервисы домена (Domain Services)**: Бизнес-логика между агрегатами

## TypeScript стандарты

### Типизация
Всегда используйте строгую типизацию TypeScript:

```typescript
// ✅ Правильно: Использование конкретных типов
interface CreateGameRequest {
  title: string
  dateTime: Date
  maxPlayers: number
  organizerId: string
}

async function createGame(request: CreateGameRequest): Promise<Game> {
  return await this.gameService.createGame(request)
}

// ❌ Неправильно: Использование any
async function createGame(request: any): Promise<any> {
  return await this.gameService.createGame(request)
}
```

### Интерфейсы vs Типы
- Используйте `interface` для объектных типов и расширения
- Используйте `type` для примитивных типов и объединений

```typescript
// ✅ Правильно: Интерфейс для объекта
interface User {
  id: string
  firstName: string
  lastName?: string
}

// ✅ Правильно: Type для объединений
type GameStatus = 'draft' | 'open' | 'closed' | 'cancelled'
type Level = 'beginner' | 'intermediate' | 'advanced' | 'professional'
```

### Generics
Используйте дженерики для создания переиспользуемого кода:

```typescript
// ✅ Правильно: Использование дженериков
export class Repository<T extends Entity> {
  async findById(id: string): Promise<T | null> {
    // Реализация
  }

  async save(entity: T): Promise<T> {
    // Реализация
  }
}

// Использование
const userRepository = new Repository<User>()
const gameRepository = new Repository<Game>()
```

### Union Types и Enum
Предпочитайте Enum для фиксированных наборов значений:

```typescript
// ✅ Правильно: Enum для фиксированных значений
enum UserLevel {
  Beginner = 'beginner',
  Intermediate = 'intermediate',
  Advanced = 'advanced',
  Professional = 'professional'
}

// ✅ Правильно: Union типы для вариантов
type RegistrationStatus = 'pending' | 'confirmed' | 'cancelled'
type PaymentMethod = 'card' | 'cash' | 'bank_transfer'
```

## Структура проекта

### Директории и файлы
Следуйте четкой структуре проекта:

```
src/
├── api/                    # HTTP API слой
├── application/            # Use cases и сервисы приложения
│   ├── services/          # Сервисы приложения
│   ├── queries/           # Запросы данных
│   └── commands/          # Команды для изменения состояния
├── bot/                    # Telegram бот
│   ├── modules/           # Модули бота
│   ├── handlers/          # Обработчики команд
│   └── common/            # Общие компоненты
├── domain/                # Доменные модели и логика
│   ├── entities/          # Сущности
│   ├── value-objects/     # Объекты-значения
│   ├── services/          # Сервисы домена
│   └── errors/            # Исключения домена
├── infrastructure/        # Внешние зависимости
│   ├── repositories/      # Реализация репозиториев
│   ├── database/          # Конфигурация БД
│   └── external/          # Внешние сервисы
└── shared/                # Общие утилиты
    ├── types/             # Общие типы
    ├── utils/             # Утилиты
    └── constants/         # Константы
```

### Файлы модулей
- Каждый файл должен иметь единственную экспортируемую сущность
- Используйте индексные файлы для экспортов

```typescript
// ✅ Правильно: Единичный экспорт в файле
// user-service.ts
export class UserService {
  // имплементация
}

// ✅ Правильно: Индексный файл
// index.ts
export { UserService } from './user-service'
export { UserRepository } from './user-repository'
```

## Именование

### Классы
Используйте PascalCase для классов:

```typescript
// ✅ Правильно
export class UserService {}
export class GameController {}
export class PaymentProcessor {}

// ❌ Неправильно
export class userService {}
export class gameController {}
export class payment_processor {}
```

### Функции и методы
Используйте camelCase для функций и методов:

```typescript
// ✅ Правильно
function createUser(): User {}
function validateEmail(): boolean {}

// ✅ Правильно: Глагол + объект
class UserService {
  createUser(): Promise<User> {}
  updateProfile(): Promise<User> {}
  deleteUser(): Promise<void> {}
}
```

### Переменные и константы
Используйте camelCase для переменных и UPPER_SNAKE_CASE для констант:

```typescript
// ✅ Правильно: Переменные
const userName = 'Ivan'
let gameStatus = 'draft'
const isActive = true

// ✅ Правильно: Константы
const API_BASE_URL = 'https://api.example.com'
const MAX_PLAYERS = 12
const DEFAULT_TIMEOUT = 5000

// ✅ Правильно: Константы объекта
const USER_LEVELS = {
  BEGINNER: 'beginner',
  INTERMEDIATE: 'intermediate',
  ADVANCED: 'advanced'
} as const
```

### Интерфейсы и типы
Используйте PascalCase с описательными именами:

```typescript
// ✅ Правильно: Интерфейсы
interface UserRegistrationRequest {}
interface GameCreationResponse {}
interface PaymentProcessingData {}

// ✅ Правильно: Type aliases
type UserId = string
type GameStatus = 'draft' | 'open' | 'closed'
type ApiResponse<T> = {
  success: boolean
  data: T
  message?: string
}
```

### Файлы и папки
Используйте kebab-case для имен файлов и папок:

```
// ✅ Правильно
user-service.ts
game-controller.ts
payment-processor.ts
user-repository.ts

// ❌ Неправильно
UserService.ts
GameController.ts
paymentProcessor.ts
userRepository.ts
```

## Комментарии и документация

### JSDoc комментарии
Используйте JSDoc для документирования публичного API:

```typescript
/**
 * Сервис для управления пользователями
 * Отвечает за создание, обновление и удаление пользователей
 */
export class UserService {
  /**
   * Создает нового пользователя в системе
   * 
   * @param userData - Данные для создания пользователя
   * @returns Созданный объект пользователя
   * @throws {ValidationError} Если данные пользователя неверны
   * @throws {DuplicateUserError} Если пользователь уже существует
   */
  async createUser(userData: CreateUserRequest): Promise<User> {
    // Реализация
  }

  /**
   * Обновляет профиль пользователя
   * 
   * @param userId - Идентификатор пользователя
   * @param updates - Данные для обновления
   * @returns Обновленный объект пользователя
   */
  async updateProfile(userId: string, updates: UpdateUserRequest): Promise<User> {
    // Реализация
  }
}
```

### Inline комментарии
Используйте комментарии для объяснения сложной логики:

```typescript
// ✅ Правильно: Объяснение сложной логики
function calculateGameScore(game: Game, registrations: Registration[]): number {
  // Базовая оценка: количество игроков * коэффициент сложности
  let score = registrations.length * game.difficulty

  // Бонус за полную команду
  if (registrations.length === game.maxPlayers) {
    score *= 1.2 // 20% бонус за полную команду
  }

  // Штраф за короткое время до игры
  const timeUntilGame = game.startTime.getTime() - Date.now()
  if (timeUntilGame < 24 * 60 * 60 * 1000) { // меньше 24 часов
    score *= 0.9 // 10% штраф
  }

  return Math.round(score)
}

// ❌ Неправильно: Избыточные комментарии
let score = 0 // инициализируем score нулем
score += 10 // добавляем 10
```

### TODO и FIXME комментарии
Используйте стандартные маркеры для задач:

```typescript
// TODO: Реализовать валидацию email адреса
async function validateEmail(email: string): boolean {
  return email.includes('@')
}

// FIXME: Нужно оптимизировать запрос к базе данных
async function getUserGames(userId: string): Promise<Game[]> {
  return await this.gameRepository.findByUserId(userId)
}
```

## Обработка ошибок

### Типы ошибок
Определите специфичные типы ошибок для разных случаев:

```typescript
// ✅ Правильно: Иерархия ошибок
export abstract class DomainError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly context?: Record<string, any>
  ) {
    super(message)
  }
}

export class ValidationError extends DomainError {
  constructor(message: string, public readonly field?: string) {
    super(message, 'VALIDATION_ERROR', { field })
  }
}

export class NotFoundError extends DomainError {
  constructor(resource: string, id: string) {
    super(`${resource} с id ${id} не найден`, 'NOT_FOUND', { resource, id })
  }
}

export class BusinessRuleError extends DomainError {
  constructor(message: string, public readonly rule: string) {
    super(message, 'BUSINESS_RULE_VIOLATION', { rule })
  }
}
```

### Обработка ошибок в сервисах
Всегда обрабатывайте ошибки на соответствующем уровне:

```typescript
// ✅ Правильно: Обработка ошибок в сервисе
export class UserService {
  async createUser(userData: CreateUserRequest): Promise<User> {
    try {
      // Проверка существования пользователя
      const existingUser = await this.userRepository.findByTelegramId(userData.telegramId)
      if (existingUser) {
        throw new BusinessRuleError('Пользователь уже существует', 'USER_EXISTS')
      }

      // Создание пользователя
      const user = User.create(userData)
      return await this.userRepository.save(user)

    } catch (error) {
      // Логирование ошибки
      this.logger.error('Ошибка при создании пользователя', error, { userData })

      // Переброс доменных ошибок
      if (error instanceof DomainError) {
        throw error
      }

      // Преобразование технических ошибок
      throw new SystemError('Внутренняя ошибка сервера', error)
    }
  }
}
```

### Result Type
Рассмотрите использование Result типа для безопасной обработки ошибок:

```typescript
// ✅ Правильно: Result тип
type Result<T, E = Error> = 
  | { success: true; value: T }
  | { success: false; error: E }

export class UserService {
  async createUser(userData: CreateUserRequest): Promise<Result<User, ValidationError | BusinessRuleError>> {
    try {
      // Валидация данных
      const validationResult = this.validateUserData(userData)
      if (!validationResult.isValid) {
        return { success: false, error: new ValidationError(validationResult.message) }
      }

      // Проверка дублирования
      const existingUser = await this.userRepository.findByTelegramId(userData.telegramId)
      if (existingUser) {
        return { success: false, error: new BusinessRuleError('Пользователь уже существует') }
      }

      // Создание пользователя
      const user = User.create(userData)
      const savedUser = await this.userRepository.save(user)

      return { success: true, value: savedUser }

    } catch (error) {
      return { success: false, error: new SystemError('Внутренняя ошибка', error) }
    }
  }
}
```

## Тестирование

### Структура тестов
Следуйте соглашению AAA (Arrange-Act-Assert):

```typescript
// ✅ Правильно: Структура теста
describe('UserService', () => {
  let userService: UserService
  let mockUserRepository: jest.Mocked<UserRepository>
  let mockLogger: jest.Mocked<Logger>

  beforeEach(() => {
    mockUserRepository = createMock<UserRepository>()
    mockLogger = createMock<Logger>()
    userService = new UserService(mockUserRepository, mockLogger)
  })

  describe('createUser', () => {
    it('should create user successfully', async () => {
      // Arrange
      const userData: CreateUserRequest = {
        telegramId: 123456,
        firstName: 'Ivan',
        lastName: 'Petrov',
        level: 'intermediate'
      }

      const expectedUser = User.create(userData)
      mockUserRepository.findByTelegramId.mockResolvedValue(null)
      mockUserRepository.save.mockResolvedValue(expectedUser)

      // Act
      const result = await userService.createUser(userData)

      // Assert
      expect(result).toEqual(expectedUser)
      expect(mockUserRepository.findByTelegramId).toHaveBeenCalledWith(123456)
      expect(mockUserRepository.save).toHaveBeenCalledWith(expectedUser)
    })

    it('should throw BusinessRuleError if user already exists', async () => {
      // Arrange
      const userData: CreateUserRequest = {
        telegramId: 123456,
        firstName: 'Ivan',
        lastName: 'Petrov',
        level: 'intermediate'
      }

      const existingUser = User.create(userData)
      mockUserRepository.findByTelegramId.mockResolvedValue(existingUser)

      // Act & Assert
      await expect(userService.createUser(userData))
        .rejects.toThrow(BusinessRuleError)
    })
  })
})
```

### Тестовые данные
Используйте factories для создания тестовых данных:

```typescript
// ✅ Правильно: Factory для тестовых данных
export class UserFactory {
  static create(overrides: Partial<User> = {}): User {
    return User.create({
      telegramId: 123456,
      firstName: 'Test',
      lastName: 'User',
      level: 'intermediate',
      ...overrides
    })
  }

  static createMany(count: number, overrides: Partial<User> = {}): User[] {
    return Array.from({ length: count }, (_, index) =>
      this.create({
        telegramId: 1000000 + index,
        firstName: `User${index}`,
        ...overrides
      })
    )
  }
}
```

## Инструменты

### ESLint конфигурация
Используйте строгие правила ESLint:

```json
// .eslintrc.json
{
  "extends": [
    "@typescript-eslint/recommended",
    "plugin:import/recommended",
    "plugin:import/typescript"
  ],
  "rules": {
    "@typescript-eslint/no-unused-vars": "error",
    "@typescript-eslint/explicit-function-return-type": "error",
    "@typescript-eslint/no-explicit-any": "error",
    "prefer-const": "error",
    "no-var": "error",
    "import/no-duplicates": "error",
    "import/order": ["error", {
      "groups": ["builtin", "external", "internal", "parent", "sibling"],
      "alphabetize": { "order": "asc", "caseInsensitive": true }
    }]
  }
}
```

### Prettier конфигурация
Настройте Prettier для единообразного форматирования:

```json
// .prettierrc
{
  "semi": true,
  "trailingComma": "es5",
  "singleQuote": true,
  "printWidth": 100,
  "tabWidth": 2,
  "useTabs": false,
  "bracketSpacing": true,
  "arrowParens": "avoid"
}
```

### Husky для pre-commit hooks
Настройте автоматическую проверку кода:

```json
// .husky/pre-commit
#!/usr/bin/env sh
. "$(dirname -- "$0")/_/husky.sh"

npm run lint
npm run type-check
npm run test
```

### Командные скрипты
Добавьте скрипты в package.json:

```json
// package.json
{
  "scripts": {
    "dev": "ts-node-dev --respawn --transpile-only src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "test": "jest",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage",
    "lint": "eslint src/**/*.ts",
    "lint:fix": "eslint src/**/*.ts --fix",
    "type-check": "tsc --noEmit",
    "format": "prettier --write src/**/*.ts",
    "prepare": "husky install"
  }
}
```

## Лучшие практики

### Производительность
- Используйте readonly для неизменяемых свойств
- Избегайте ненужных копий объектов
- Оптимизируйте циклы и массивные операции

```typescript
// ✅ Правильно: Оптимизированный код
class GameService {
  private readonly cachedVenues: ReadonlyArray<Venue> = []

  findAvailableGames(userId: string): readonly Game[] {
    return this.games
      .filter(game => game.isAvailableForUser(userId))
      .sort((a, b) => a.dateTime.getTime() - b.dateTime.getTime())
  }
}
```

### Безопасность
- Валидируйте все входные данные
- Используйте безопасные методы работы с базой данных
- Избегайте использования eval() и подобных функций
- Ограничивайте доступ к конфиденциальным данным

```typescript
// ✅ Правильно: Безопасная валидация
class UserValidator {
  static validateEmail(email: string): ValidationResult {
    if (!email || typeof email !== 'string') {
      return { isValid: false, message: 'Email обязателен' }
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return { isValid: false, message: 'Некорректный формат email' }
    }

    return { isValid: true }
  }

  static validatePhone(phone: string): ValidationResult {
    // Валидация телефона без использования eval
    const phoneRegex = /^\+?[1-9]\d{1,14}$/
    if (!phoneRegex.test(phone.replace(/[\s\-\(\)]/g, ''))) {
      return { isValid: false, message: 'Некорректный номер телефона' }
    }

    return { isValid: true }
  }
}
```

### Accessibility
- Обеспечьте доступность для пользователей с ограниченными возможностями
- Используйте семантические HTML теги
- Добавляйте alt-тексты для изображений

---

**Последнее обновление**: 2025-11-24  
**Версия**: 1.0.0