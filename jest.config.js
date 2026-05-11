const shared = {
  preset: 'ts-jest/presets/default-esm',
  testEnvironment: 'node',
  extensionsToTreatAsEsm: ['.ts'],
  roots: ['<rootDir>/src'],
  transform: {
    '^.+\\.ts$': ['ts-jest', {
      useESM: true,
      diagnostics: {
        ignoreCodes: [151002]
      }
    }],
  },
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
    '^telegraf/lib/core/network/client\\.js$': '<rootDir>/node_modules/telegraf/lib/core/network/client.js',
  },
  transformIgnorePatterns: [],
  testTimeout: 60000,
};

/**
 * Глобально: внутри `projects` пороги и glob покрытия игнорируются Jest (см. jestjs/jest#8793).
 * Обработчики и модули бота исключены: их покрывают e2e (маршрутизация Telegraf). Оставляем общие утилиты и фабрику.
 */
const collectCoverageFrom = [
  'src/**/*.{ts,js}',
  '!src/**/*.d.ts',
  '!src/tests/**',
  '!src/**/*.test.ts',
  '!src/**/*.spec.ts',
  '!src/bot/**/*.ts',
  'src/bot/common/**/*.ts',
  '!src/bot/common/base-handler.ts',
  '!src/bot/common/common-handlers.ts',
  '!src/bot/common/index.ts',
  '!src/shared/enhanced-logger.ts',
  '!src/shared/layer-logger.ts',
  '!src/shared/logging-messages.ts',
  '!src/shared/event-handlers.ts',
  // Инфраструктура уведомлений / планировщика — без отдельных unit; смок через приложение и e2e
  '!src/shared/enhanced-notification-service.ts',
  '!src/shared/notification-service.ts',
  '!src/shared/scheduler.ts',
  '!src/shared/scheduler-service.ts',
  '!src/infrastructure/health.ts',
  '!src/shared/idempotency-service.ts',
  '!src/shared/rate-limiter.ts',
  '!src/shared/notification-metrics.ts',
  '!src/infrastructure/prisma-types.ts',
];

export default {
  coverageProvider: 'v8',
  collectCoverageFrom,
  coverageReporters: ['text', 'lcov', 'html'],
  coverageThreshold: {
    global: {
      /** Ветки: TS + V8 дают много ложных «веток» на тернарники в парсерах и use-cases; порог ниже, чем по строкам. */
      branches: 73,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },
  projects: [
    {
      displayName: 'unit-integration',
      ...shared,
      testMatch: ['<rootDir>/src/**/*.test.ts'],
      testPathIgnorePatterns: [
        '/node_modules/',
        '<rootDir>/src/tests/e2e/',
        ...(process.env.SKIP_INTEGRATION_TESTS ? ['<rootDir>/src/tests/integration.test.ts'] : [])
      ],
      setupFilesAfterEnv: ['<rootDir>/src/tests/setup-unit-integration.ts'],
      coverageDirectory: '<rootDir>/coverage',
    },
    {
      displayName: 'e2e',
      ...shared,
      testMatch: ['<rootDir>/src/tests/e2e/**/*.test.ts'],
      setupFilesAfterEnv: ['<rootDir>/src/tests/setup-e2e.ts'],
      coverageDirectory: '<rootDir>/coverage-e2e',
    },
  ],
};
