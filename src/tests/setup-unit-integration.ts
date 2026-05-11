import { jest } from '@jest/globals';

// Мокирование BullMQ
jest.mock('bullmq', () => ({
  Queue: jest.fn().mockImplementation(() => ({
    add: jest.fn(),
    close: jest.fn()
  })),
  Worker: jest.fn().mockImplementation(() => ({
    on: jest.fn()
  }))
}));

// Мокирование Telegraf (unit/integration не поднимают реальный роутинг)
jest.mock('telegraf', () => ({
  Telegraf: jest.fn().mockImplementation(() => ({
    telegram: {
      sendMessage: jest.fn()
    }
  }))
}));

beforeEach(() => {
  jest.clearAllMocks();
});

process.env.TELEGRAM_BOT_TOKEN = 'test-token';
process.env.REDIS_HOST = 'localhost';
process.env.REDIS_PORT = '6379';
process.env.DEFAULT_TIMEZONE = 'Asia/Irkutsk';
process.env.DEFAULT_LOCALE = 'ru-RU';
