# Стратегия тестирования

## Обзор
Данный документ описывает комплексную стратегию тестирования для проекта VBallAgregator, включающую различные уровни тестирования, инструменты и процессы для обеспечения качества программного обеспечения.

## Содержание
- [Принципы тестирования](#принципы-тестирования)
- [Пирамида тестирования](#пирамида-тестирования)
- [Типы тестов](#типы-тестов)
- [Инструменты тестирования](#инструменты-тестирования)
- [Структура тестов](#структура-тестов)
- [Моки и стабы](#моки-и-стабы)
- [Непрерывная интеграция](#непрерывная-интеграция)
- [Метрики качества](#метрики-качества)

## Принципы тестирования

### Принципы Agile Testing
Тестирование является неотъемлемой частью разработки:

1. **Непрерывное тестирование**: Тесты пишутся одновременно с кодом
2. **Раннее тестирование**: Тестирование начинается на ранних этапах разработки
3. **Обратная связь**: Быстрое получение результатов тестирования
4. **Коллективная ответственность**: Качество - ответственность всей команды

### Тест-Driven Development (TDD)
Следуем принципам TDD для критически важных компонентов:

```typescript
// 1. Красный тест - сначала пишем тест
describe('UserService', () => {
  it('should create user with valid data', async () => {
    const userData = createValidUserData()
    const userService = new UserService(mockRepository)
    
    const result = await userService.createUser(userData)
    
    expect(result).toBeDefined()
    expect(result.id).toBeDefined()
  })
})

// 2. Зеленый тест - минимальная реализация
export class UserService {
  async createUser(userData: CreateUserRequest): Promise<User> {
    return {
      id: 'generated-id',
      ...userData
    } as User
  }
}

// 3. Рефакторинг - улучшение реализации
export class UserService {
  async createUser(userData: CreateUserRequest): Promise<User> {
    this.validateUserData(userData) // добавляем валидацию
    
    const user = User.create(userData) // используем доменную логику
    return await this.userRepository.save(user)
  }
}
```

### Behavior-Driven Development (BDD)
Для пользовательских сценариев используем BDD:

```typescript
// Файл: features/user-registration.feature
Feature: User Registration
  As a new user
  I want to register in the system
  So that I can participate in volleyball games

  Scenario: Successful registration
    Given I am a new Telegram user
    When I send /start command
    And I provide my basic information
    Then I should be registered in the system
    And I should see a welcome message
```

```typescript
// Файл: tests/bdd/user-registration.steps.ts
import { Given, When, Then } from '@cucumber/cucumber'
import { UserService } from '../../src/application/services/user-service'
import { expect } from 'chai'

let userService: UserService
let result: any

Given('I am a new Telegram user', function () {
  userService = new UserService(mockUserRepository)
})

When('I send /start command', async function () {
  const startData = {
    telegramId: 123456,
    firstName: 'John',
    lastName: 'Doe'
  }
  result = await userService.createUser(startData)
})

Then('I should be registered in the system', function () {
  expect(result).to.be.not.null
  expect(result.id).to.be.a('string')
})
```

## Пирамида тестирования

### Распределение тестов
Следуем классической пирамиде тестирования:

```
                  /\
                 /  \
                /E2E \      E2E тесты (5-10%)
               /______\
              /        \
             /Integration\ Интеграционные тесты (20-30%)
            /____________\
           /              \
          /   Unit Tests   \ Модульные тесты (60-70%)
         /__________________\
```

### Процентное соотношение
- **Модульные тесты**: 65% (60-70%)
- **Интеграционные тесты**: 25% (20-30%)
- **E2E тесты**: 10% (5-10%)

## Типы тестов

### Модульные тесты (Unit Tests)
Тестирование отдельных компонентов в изоляции:

```typescript
// tests/unit/domain/user.test.ts
import { User } from '../../../src/domain/user'
import { UserLevel } from '../../../src/shared/types'

describe('User Entity', () => {
  describe('create', () => {
    it('should create user with valid data', () => {
      const userData = {
        telegramId: 123456,
        firstName: 'Ivan',
        lastName: 'Petrov',
        level: UserLevel.Intermediate
      }

      const user = User.create(userData)

      expect(user.id).toBeDefined()
      expect(user.telegramId).toBe(123456)
      expect(user.firstName).toBe('Ivan')
      expect(user.lastName).toBe('Petrov')
      expect(user.level).toBe(UserLevel.Intermediate)
    })

    it('should throw validation error for invalid telegram ID', () => {
      const invalidData = {
        telegramId: -1,
        firstName: 'Ivan',
        lastName: 'Petrov',
        level: UserLevel.Intermediate
      }

      expect(() => User.create(invalidData))
        .toThrow('Invalid telegram ID')
    })

    it('should generate unique ID for each user', () => {
      const userData1 = { telegramId: 123, firstName: 'A', level: UserLevel.Beginner }
      const userData2 = { telegramId: 456, firstName: 'B', level: UserLevel.Advanced }

      const user1 = User.create(userData1)
      const user2 = User.create(userData2)

      expect(user1.id).not.toBe(user2.id)
    })
  })

  describe('updateProfile', () => {
    it('should update user profile successfully', () => {
      const user = User.create({
        telegramId: 123456,
        firstName: 'Ivan',
        level: UserLevel.Intermediate
      })

      user.updateProfile({
        firstName: 'Alexander',
        level: UserLevel.Advanced
      })

      expect(user.firstName).toBe('Alexander')
      expect(user.level).toBe(UserLevel.Advanced)
    })
  })
})
```

### Интеграционные тесты
Тестирование взаимодействия между компонентами:

```typescript
// tests/integration/user-service.test.ts
import { UserService } from '../../src/application/services/user-service'
import { UserRepository } from '../../src/infrastructure/repositories/user-repository'
import { PrismaUserRepository } from '../../src/infrastructure/repositories/prisma-user-repository'

describe('UserService Integration', () => {
  let userService: UserService
  let userRepository: UserRepository

  beforeAll(async () => {
    // Настройка тестовой базы данных
    await setupTestDatabase()
    
    userRepository = new PrismaUserRepository()
    userService = new UserService(userRepository, mockLogger, mockEventBus)
  })

  afterAll(async () => {
    await cleanupTestDatabase()
  })

  describe('createUser', () => {
    it('should create user and persist to database', async () => {
      const userData = {
        telegramId: 123456,
        firstName: 'Ivan',
        lastName: 'Petrov',
        level: UserLevel.Intermediate
      }

      const user = await userService.createUser(userData)

      // Проверяем, что пользователь сохранен в БД
      const savedUser = await userRepository.findByTelegramId(123456)
      expect(savedUser).toBeDefined()
      expect(savedUser!.telegramId).toBe(123456)
      expect(savedUser!.firstName).toBe('Ivan')
    })

    it('should send welcome notification', async () => {
      const mockNotificationService = jest.fn()
      
      await userService.createUser({
        telegramId: 654321,
        firstName: 'Maria',
        level: UserLevel.Beginner
      })

      expect(mockNotificationService).toHaveBeenCalledWith(
        654321,
        expect.stringContaining('Добро пожаловать')
      )
    })
  })

  describe('findUsers', () => {
    beforeEach(async () => {
      // Создаем тестовых пользователей
      await createTestUsers([
        { telegramId: 111, firstName: 'Alice', level: UserLevel.Beginner },
        { telegramId: 222, firstName: 'Bob', level: UserLevel.Intermediate },
        { telegramId: 333, firstName: 'Charlie', level: UserLevel.Advanced }
      ])
    })

    it('should filter users by level', async () => {
      const users = await userService.findUsers({ level: UserLevel.Intermediate })

      expect(users).toHaveLength(1)
      expect(users[0].firstName).toBe('Bob')
    })

    it('should return users in correct order', async () => {
      const users = await userService.findUsers({})

      expect(users[0].firstName).toBe('Alice') // По имени (A, B, C)
    })
  })
})
```

### End-to-End (E2E) тесты
Тестирование полных пользовательских сценариев:

```typescript
// tests/e2e/user-registration.test.ts
import { TestClient } from './test-client'
import { createTestUser } from './test-data'

describe('User Registration E2E', () => {
  let client: TestClient

  beforeAll(async () => {
    client = new TestClient()
    await client.start()
  })

  afterAll(async () => {
    await client.stop()
  })

  describe('Complete registration flow', () => {
    it('should register new user through Telegram bot', async () => {
      const user = createTestUser()

      // 1. Пользователь отправляет /start
      const startResponse = await client.sendMessage(user, '/start')
      
      expect(startResponse.text).toContain('Добро пожаловать в VBallAgregator')
      expect(startResponse.hasKeyboard).toBe(true)

      // 2. Пользователь выбирает "Зарегистрироваться"
      const registerResponse = await client.sendCallbackQuery(user, 'register')
      
      expect(registerResponse.text).toContain('Укажите ваше имя')
      expect(registerResponse.hasKeyboard).toBe(false)

      // 3. Пользователь вводит имя
      const nameResponse = await client.sendMessage(user, 'Ivan Petrov')
      
      expect(nameResponse.text).toContain('Выберите ваш уровень игры')

      // 4. Пользователь выбирает уровень
      const levelResponse = await client.sendCallbackQuery(user, 'level_intermediate')
      
      expect(levelResponse.text).toContain('Регистрация завершена')
      expect(levelResponse.hasKeyboard).toBe(true)
      expect(levelResponse.keyboard).toContain('Мой профиль')

      // 5. Проверяем, что пользователь создан в системе
      const profile = await client.getUserProfile(user.id)
      expect(profile.firstName).toBe('Ivan')
      expect(profile.lastName).toBe('Petrov')
      expect(profile.level).toBe('intermediate')
    })
  })

  describe('Game registration flow', () => {
    let organizer: TestUser
    let player: TestUser
    let gameId: string

    beforeEach(async () => {
      // Создаем организатора
      organizer = createTestUser({ id: 999001, isOrganizer: true })
      await client.sendMessage(organizer, '/start')
      await client.completeRegistration(organizer, 'Organizer', 'User')

      // Создаем игрока
      player = createTestUser({ id: 999002 })
      await client.sendMessage(player, '/start')
      await client.completeRegistration(player, 'Player', 'User')

      // Организатор создает игру
      await client.sendMessage(organizer, '/create')
      const gameResponse = await client.createGame(organizer, {
        title: 'Test Game',
        dateTime: new Date(Date.now() + 24 * 60 * 60 * 1000), // завтра
        maxPlayers: 6
      })
      gameId = gameResponse.gameId
    })

    it('should complete game registration flow', async () => {
      // 1. Игрок просматривает список игр
      const gamesResponse = await client.sendMessage(player, '/games')
      expect(gamesResponse.text).toContain('Test Game')

      // 2. Игрок регистрируется на игру
      const registerResponse = await client.sendCallbackQuery(player, `register_${gameId}`)
      expect(registerResponse.text).toContain('успешно зарегистрированы')

      // 3. Проверяем регистрацию в системе
      const registrations = await client.getUserRegistrations(player.id)
      expect(registrations).toHaveLength(1)
      expect(registrations[0].gameId).toBe(gameId)
      expect(registrations[0].status).toBe('pending')
    })
  })
})
```

## Инструменты тестирования

### Основные инструменты
- **Jest**: Фреймворк для модульного тестирования
- **Supertest**: Тестирование HTTP API
- **Testing Library**: Тестирование пользовательских интерфейсов
- **Cucumber**: BDD тестирование
- **Playwright**: E2E тестирование

### Конфигурация Jest
```javascript
// jest.config.js
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src', '<rootDir>/tests'],
  testMatch: [
    '**/__tests__/**/*.test.ts',
    '**/*.test.ts',
    '**/*.spec.ts'
  ],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/**/index.ts'
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
  testTimeout: 10000,
  verbose: true,
  forceExit: true,
  clearMocks: true,
  restoreMocks: true
}
```

### Настройка тестового окружения
```typescript
// tests/setup.ts
import { jest } from '@jest/globals'
import dotenv from 'dotenv'

// Загрузка тестового .env файла
dotenv.config({ path: '.env.test' })

// Глобальные моки
global.fetch = jest.fn()

// Настройка Jest
beforeEach(() => {
  jest.clearAllMocks()
})

afterEach(() => {
  jest.restoreAllMocks()
})

// Обработка необработанных промисов
process.on('unhandledRejection', (reason) => {
  console.error('Unhandled Rejection:', reason)
})

// Увеличиваем таймаут для интеграционных тестов
jest.setTimeout(30000)
```

## Структура тестов

### Организация тестовых файлов
```
tests/
├── unit/                   # Модульные тесты
│   ├── domain/
│   │   ├── user.test.ts
│   │   ├── game.test.ts
│   │   └── registration.test.ts
│   ├── application/
│   │   ├── services/
│   │   └── use-cases/
│   └── infrastructure/
├── integration/            # Интеграционные тесты
│   ├── api/
│   ├── repositories/
│   └── services/
├── e2e/                    # End-to-end тесты
│   ├── user-flows/
│   ├── game-flows/
│   └── payment-flows/
├── fixtures/               # Тестовые данные
│   ├── users.ts
│   ├── games.ts
│   └── payments.ts
├── helpers/                # Вспомогательные функции
│   ├── mocks.ts
│   ├── factories.ts
│   └── test-client.ts
└── setup.ts               # Настройка тестового окружения
```

### Тестовые фабрики
```typescript
// tests/helpers/factories.ts
import { User, UserLevel } from '../../src/domain/user'
import { Game, GameStatus, GameLevel } from '../../src/domain/game'
import { Registration, RegistrationStatus } from '../../src/domain/registration'

export class UserFactory {
  static create(overrides: Partial<User> = {}): User {
    const defaultData = {
      telegramId: 1000000 + Math.floor(Math.random() * 1000000),
      firstName: 'Test',
      lastName: 'User',
      level: UserLevel.Intermediate,
      isOrganizer: false,
      preferences: {
        notifications: {
          gameReminders: true,
          cancellations: true,
          newGames: false
        }
      }
    }

    return User.create({ ...defaultData, ...overrides })
  }

  static createOrganizer(overrides: Partial<User> = {}): User {
    return this.create({
      isOrganizer: true,
      level: UserLevel.Advanced,
      ...overrides
    })
  }

  static createMany(count: number, overrides: Partial<User> = {}): User[] {
    return Array.from({ length: count }, () => this.create(overrides))
  }
}

export class GameFactory {
  static create(overrides: Partial<Game> = {}): Game {
    const organizer = UserFactory.createOrganizer()
    const defaultData = {
      title: 'Test Game',
      description: 'A test volleyball game',
      dateTime: new Date(Date.now() + 24 * 60 * 60 * 1000), // завтра
      duration: 120,
      maxPlayers: 12,
      minPlayers: 6,
      level: GameLevel.Intermediate,
      price: 500,
      currency: 'RUB'
    }

    return Game.create(organizer, { ...defaultData, ...overrides })
  }

  static createOpen(overrides: Partial<Game> = {}): Game {
    return this.create({
      status: GameStatus.Open,
      ...overrides
    })
  }

  static createFull(overrides: Partial<Game> = {}): Game {
    const game = this.create({
      maxPlayers: 6,
      ...overrides
    })

    // Добавляем максимальное количество игроков
    const players = UserFactory.createMany(6)
    players.forEach(player => {
      game.registerPlayer(player)
    })

    return game
  }
}
```

## Моки и стабы

### Создание моков
```typescript
// tests/helpers/mocks.ts
import { jest } from '@jest/globals'
import { UserRepository } from '../../src/infrastructure/repositories/user-repository'
import { GameRepository } from '../../src/infrastructure/repositories/game-repository'
import { NotificationService } from '../../src/infrastructure/notification-service'

export function createMockUserRepository(): jest.Mocked<UserRepository> {
  return {
    save: jest.fn(),
    findById: jest.fn(),
    findByTelegramId: jest.fn(),
    findAll: jest.fn(),
    delete: jest.fn(),
    exists: jest.fn()
  }
}

export function createMockGameRepository(): jest.Mocked<GameRepository> {
  return {
    save: jest.fn(),
    findById: jest.fn(),
    findAvailable: jest.fn(),
    findByOrganizer: jest.fn(),
    delete: jest.fn(),
    exists: jest.fn()
  }
}

export function createMockNotificationService(): jest.Mocked<NotificationService> {
  return {
    sendMessage: jest.fn(),
    sendGameReminder: jest.fn(),
    sendRegistrationConfirmation: jest.fn(),
    sendGameCancellation: jest.fn()
  }
}

export function createMockLogger(): jest.Mocked<Logger> {
  return {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  }
}

export function createMockEventBus(): jest.Mocked<EventBus> {
  return {
    subscribe: jest.fn(),
    publish: jest.fn()
  }
}
```

### Использование моков в тестах
```typescript
// tests/unit/application/user-service.test.ts
import { UserService } from '../../../src/application/services/user-service'
import { UserRepository } from '../../../src/infrastructure/repositories/user-repository'
import { createMockUserRepository, createMockLogger, createMockEventBus } from '../../helpers/mocks'
import { UserFactory } from '../../helpers/factories'

describe('UserService', () => {
  let userService: UserService
  let mockUserRepository: jest.Mocked<UserRepository>
  let mockLogger: jest.Mocked<Logger>
  let mockEventBus: jest.Mocked<EventBus>

  beforeEach(() => {
    mockUserRepository = createMockUserRepository()
    mockLogger = createMockLogger()
    mockEventBus = createMockEventBus()
    
    userService = new UserService(mockUserRepository, mockLogger, mockEventBus)
  })

  describe('createUser', () => {
    it('should save user and emit event', async () => {
      // Arrange
      const userData = {
        telegramId: 123456,
        firstName: 'Ivan',
        lastName: 'Petrov',
        level: UserLevel.Intermediate
      }

      const expectedUser = UserFactory.create(userData)
      mockUserRepository.save.mockResolvedValue(expectedUser)

      // Act
      const result = await userService.createUser(userData)

      // Assert
      expect(mockUserRepository.save).toHaveBeenCalledWith(expectedUser)
      expect(mockEventBus.publish).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'user.created',
          user: expectedUser
        })
      )
    })

    it('should handle database errors', async () => {
      // Arrange
      const userData = { telegramId: 123456, firstName: 'Ivan', level: UserLevel.Beginner }
      const dbError = new Error('Database connection failed')
      mockUserRepository.save.mockRejectedValue(dbError)

      // Act & Assert
      await expect(userService.createUser(userData))
        .rejects.toThrow('Database connection failed')
        
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to create user',
        dbError,
        expect.any(Object)
      )
    })
  })
})
```

## Непрерывная интеграция

### GitHub Actions Workflow
```yaml
# .github/workflows/test.yml
name: Tests

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main ]

jobs:
  test:
    runs-on: ubuntu-latest
    
    services:
      postgres:
        image: postgres:13
        env:
          POSTGRES_PASSWORD: postgres
          POSTGRES_DB: vball_test
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

    steps:
    - uses: actions/checkout@v3
    
    - name: Setup Node.js
      uses: actions/setup-node@v3
      with:
        node-version: '18'
        cache: 'npm'
    
    - name: Install dependencies
      run: npm ci
    
    - name: Run linting
      run: npm run lint
    
    - name: Run type checking
      run: npm run type-check
    
    - name: Setup test database
      run: |
        npm run db:migrate
        npm run db:seed:test
    
    - name: Run unit tests
      run: npm run test:unit
    
    - name: Run integration tests
      run: npm run test:integration
      env:
        DATABASE_URL: postgresql://postgres:postgres@localhost:5432/vball_test
    
    - name: Run E2E tests
      run: npm run test:e2e
      env:
        TEST_BOT_TOKEN: ${{ secrets.TEST_BOT_TOKEN }}
        DATABASE_URL: postgresql://postgres:postgres@localhost:5432/vball_test
    
    - name: Generate test coverage
      run: npm run test:coverage
    
    - name: Upload coverage to Codecov
      uses: codecov/codecov-action@v3
      with:
        file: ./coverage/lcov.info
        fail_ci_if_error: true
    
    - name: Archive test results
      uses: actions/upload-artifact@v3
      if: always()
      with:
        name: test-results
        path: |
          coverage/
          test-results/
        retention-days: 30
```

### NPM скрипты для тестирования
```json
{
  "scripts": {
    "test": "jest",
    "test:unit": "jest --testPathPattern=tests/unit",
    "test:integration": "jest --testPathPattern=tests/integration",
    "test:e2e": "jest --testPathPattern=tests/e2e",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage",
    "test:ci": "jest --ci --coverage --watchAll=false --maxWorkers=2",
    "test:integration:setup": "npm run db:migrate:test && npm run db:seed:test",
    "test:e2e:setup": "npm run test:integration:setup && npm run test:server:start"
  }
}
```

## Метрики качества

### Покрытие кода (Code Coverage)
Целевые показатели покрытия:

- **Общее покрытие**: ≥ 80%
- **Покрытие доменного слоя**: ≥ 95%
- **Покрытие сервисов приложения**: ≥ 90%
- **Покрытие контроллеров**: ≥ 85%
- **Покрытие утилит**: ≥ 70%

### Качество тестов
Критерии качества тестов:

1. **Readability**: Тесты легко читаются и понимаются
2. **Reliability**: Тесты надежны и не дают ложных срабатываний
3. **Independence**: Тесты независимы друг от друга
4. **Maintainability**: Тесты легко поддерживать при изменении кода
5. **Speed**: Тесты выполняются быстро

### Мониторинг качества
```typescript
// tests/metrics/quality-metrics.ts
export interface TestMetrics {
  totalTests: number
  passedTests: number
  failedTests: number
  skippedTests: number
  coverage: {
    lines: number
    functions: number
    branches: number
    statements: number
  }
  performance: {
    unitTests: number // мс
    integrationTests: number // мс
    e2eTests: number // мс
  }
}

export class QualityMonitor {
  static async collectMetrics(): Promise<TestMetrics> {
    // Сбор метрик покрытия
    const coverage = await this.getCoverageReport()
    
    // Сбор метрик производительности
    const performance = await this.runPerformanceTests()
    
    // Анализ результатов тестов
    const testResults = await this.getTestResults()
    
    return {
      totalTests: testResults.numTotalTests,
      passedTests: testResults.numPassedTests,
      failedTests: testResults.numFailedTests,
      skippedTests: testResults.numPendingTests,
      coverage,
      performance
    }
  }

  static checkQualityGate(metrics: TestMetrics): boolean {
    const coverageGate = metrics.coverage.statements >= 80
    const reliabilityGate = metrics.failedTests === 0
    const performanceGate = metrics.performance.unitTests < 5000 // 5 секунд
    
    return coverageGate && reliabilityGate && performanceGate
  }
}
```

### Отчеты о качестве
```typescript
// tests/reporting/test-reporter.ts
import { TestMetrics } from '../metrics/quality-metrics'

export class TestReporter {
  static generateReport(metrics: TestMetrics): string {
    return `
# Отчет о тестировании

## Общая информация
- Общее количество тестов: ${metrics.totalTests}
- Пройдено: ${metrics.passedTests}
- Провалено: ${metrics.failedTests}
- Пропущено: ${metrics.skippedTests}
- Показатель успешности: ${((metrics.passedTests / metrics.totalTests) * 100).toFixed(2)}%

## Покрытие кода
- Строки: ${metrics.coverage.lines.toFixed(1)}%
- Функции: ${metrics.coverage.functions.toFixed(1)}%
- Ветви: ${metrics.coverage.branches.toFixed(1)}%
- Выражения: ${metrics.coverage.statements.toFixed(1)}%

## Производительность тестов
- Модульные тесты: ${metrics.performance.unitTests}мс
- Интеграционные тесты: ${metrics.performance.integrationTests}мс
- E2E тесты: ${metrics.performance.e2eTests}мс

## Статус качества
${this.getQualityGateStatus(metrics)}
`
  }

  private static getQualityGateStatus(metrics: TestMetrics): string {
    const gates = [
      { name: 'Покрытие кода (≥80%)', passed: metrics.coverage.statements >= 80 },
      { name: 'Надежность тестов (0 провалов)', passed: metrics.failedTests === 0 },
      { name: 'Производительность (<5с)', passed: metrics.performance.unitTests < 5000 }
    ]

    const passedGates = gates.filter(gate => gate.passed).length
    const totalGates = gates.length

    if (passedGates === totalGates) {
      return '✅ Все проверки качества пройдены'
    } else {
      return `❌ Пройдено ${passedGates}/${totalGates} проверок качества`
    }
  }
}
```

---

**Последнее обновление**: 2025-11-24  
**Версия**: 1.0.0