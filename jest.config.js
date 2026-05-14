const shared = {
  preset: 'ts-jest/presets/default-esm',
  testEnvironment: 'node',
  extensionsToTreatAsEsm: ['.ts'],
  roots: ['<rootDir>/packages/core/src', '<rootDir>/packages/bot-volley/src', '<rootDir>/packages/bot-racket/src'],
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

const collectCoverageFrom = [
  'packages/core/src/**/*.{ts,js}',
  'packages/bot-volley/src/**/*.{ts,js}',
  '!packages/**/*.d.ts',
  '!packages/core/src/tests/**',
  '!packages/**/*.test.ts',
  '!packages/**/*.spec.ts',
  '!packages/bot-volley/src/**/*.ts',
  'packages/bot-volley/src/bot/common/**/*.ts',
  '!packages/bot-volley/src/bot/common/base-handler.ts',
  '!packages/bot-volley/src/bot/common/common-handlers.ts',
  '!packages/bot-volley/src/bot/common/index.ts',
  '!packages/core/src/shared/enhanced-logger.ts',
  '!packages/core/src/shared/layer-logger.ts',
  '!packages/core/src/shared/logging-messages.ts',
  '!packages/core/src/shared/event-handlers.ts',
  '!packages/core/src/shared/enhanced-notification-service.ts',
  '!packages/core/src/shared/notification-service.ts',
  '!packages/core/src/shared/scheduler.ts',
  '!packages/core/src/shared/scheduler-service.ts',
  '!packages/core/src/infrastructure/health.ts',
  '!packages/core/src/shared/idempotency-service.ts',
  '!packages/core/src/shared/rate-limiter.ts',
  '!packages/core/src/shared/notification-metrics.ts',
  '!packages/core/src/infrastructure/prisma-types.ts',
];

export default {
  coverageProvider: 'v8',
  collectCoverageFrom,
  coverageReporters: ['text', 'lcov', 'html'],
  coverageThreshold: {
    global: {
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
      testMatch: [
        '<rootDir>/packages/core/src/**/*.test.ts',
        '<rootDir>/packages/bot-racket/src/**/*.test.ts',
      ],
      testPathIgnorePatterns: [
        '/node_modules/',
        '<rootDir>/packages/core/src/tests/e2e/',
        ...(process.env.SKIP_INTEGRATION_TESTS
          ? [
              '<rootDir>/packages/core/src/tests/integration.test.ts',
              '\\.integration\\.test\\.ts$',
            ]
          : []),
      ],
      setupFilesAfterEnv: ['<rootDir>/packages/core/src/tests/setup-unit-integration.ts'],
      coverageDirectory: '<rootDir>/coverage',
    },
    {
      displayName: 'e2e',
      ...shared,
      testMatch: ['<rootDir>/packages/core/src/tests/e2e/**/*.test.ts'],
      setupFilesAfterEnv: ['<rootDir>/packages/core/src/tests/setup-e2e.ts'],
      coverageDirectory: '<rootDir>/coverage-e2e',
    },
  ],
};
