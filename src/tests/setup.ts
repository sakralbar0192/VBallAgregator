import { jest } from '@jest/globals';
import { prisma } from '../infrastructure/prisma.js';

// Хелпер-функция для очистки базы данных в правильном порядке
export async function clearDatabase(): Promise<void> {
  await prisma.registration.deleteMany();
  await prisma.game.deleteMany();
  await prisma.organizer.deleteMany();
  await prisma.user.deleteMany();
}

// Хелпер-функция для создания тестового пользователя и организатора
export async function createTestOrganizer(telegramId: bigint, name: string, title: string) {
  const user = await prisma.user.create({
    data: { telegramId, name }
  });
  const organizer = await prisma.organizer.create({
    data: { userId: user.id, title }
  });
  return { user, organizer };
}

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

// Мокирование Telegraf
jest.mock('telegraf', () => ({
  Telegraf: jest.fn().mockImplementation(() => ({
    telegram: {
      sendMessage: jest.fn()
    }
  }))
}));

// Мокирование Prisma
const mockPrisma = {
  user: {
    findUnique: jest.fn(),
    upsert: jest.fn(),
    update: jest.fn()
  },
  organizer: {
    findUnique: jest.fn(),
    upsert: jest.fn()
  },
  game: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn()
  },
  registration: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    findFirst: jest.fn(),
    upsert: jest.fn(),
    count: jest.fn(),
    update: jest.fn()
  },
  $transaction: jest.fn(),
  $executeRaw: jest.fn()
};

jest.mock('../infrastructure/prisma.js', () => ({
  prisma: mockPrisma
}), { virtual: true });

// Настройка поведения моков по умолчанию
beforeEach(async () => {
  // Сброс всех моков перед каждым тестом
  jest.clearAllMocks();

  // Настройка успешных ответов по умолчанию
  const { prisma } = await import('../infrastructure/prisma.js');
  mockPrisma.$transaction.mockImplementation((fn: any) => fn(prisma));
  // mockPrisma.$executeRaw.mockResolvedValue(0);
});

// Настройка глобальных переменных окружения для тестов
process.env.TELEGRAM_BOT_TOKEN = 'test-token';
process.env.REDIS_HOST = 'localhost';
process.env.REDIS_PORT = '6379';
process.env.DEFAULT_TIMEZONE = 'Asia/Irkutsk';
process.env.DEFAULT_LOCALE = 'ru-RU';