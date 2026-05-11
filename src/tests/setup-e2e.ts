import { jest } from '@jest/globals';

jest.mock('bullmq', () => ({
  Queue: jest.fn().mockImplementation(() => ({
    add: jest.fn(),
    close: jest.fn()
  })),
  Worker: jest.fn().mockImplementation(() => ({
    on: jest.fn()
  }))
}));

process.env.E2E_TESTS = 'true';
process.env.REDIS_HOST = process.env.REDIS_HOST ?? 'localhost';
process.env.REDIS_PORT = process.env.REDIS_PORT ?? '6379';
process.env.DEFAULT_TIMEZONE = 'Asia/Irkutsk';
process.env.DEFAULT_LOCALE = 'ru-RU';
