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
jest.mock('telegraf', () => {
  const Markup = {
    inlineKeyboard: jest.fn(() => ({})),
    button: {
      callback: jest.fn((_label: string, data: string) => ({ type: 'callback_button', data })),
    },
    keyboard: jest.fn(() => ({
      resize: jest.fn(() => ({})),
    })),
  };
  return {
    Telegraf: jest.fn().mockImplementation(() => ({
      telegram: {
        sendMessage: jest.fn(),
      },
    })),
    Markup,
    Scenes: {
      Stage: jest.fn(),
      WizardScene: jest.fn(),
    },
    session: jest.fn(() => ({})),
  };
});

beforeEach(() => {
  jest.clearAllMocks();
});

process.env.TELEGRAM_BOT_TOKEN = 'test-token';
process.env.REDIS_HOST = 'localhost';
process.env.REDIS_PORT = '6379';
process.env.DEFAULT_TIMEZONE = 'Asia/Irkutsk';
process.env.DEFAULT_LOCALE = 'ru-RU';
