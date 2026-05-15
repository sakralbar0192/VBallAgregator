import { jest } from '@jest/globals';
import type { Context } from 'telegraf';

export type MockCallbackContextOpts = {
  data?: string;
  userId?: number;
  chatId?: number;
  messageId?: number;
  firstName?: string;
};

/** Минимальный Telegraf Context для unit-тестов callback-обработчиков. */
export function createMockCallbackContext(opts: MockCallbackContextOpts = {}): Context & {
  answerCbQuery: ReturnType<typeof jest.fn>;
  editMessageText: ReturnType<typeof jest.fn>;
  editMessageReplyMarkup: ReturnType<typeof jest.fn>;
  reply: ReturnType<typeof jest.fn>;
} {
  const userId = opts.userId ?? 42;
  const chatId = opts.chatId ?? userId;
  const messageId = opts.messageId ?? 10;

  const answerCbQuery = jest.fn(async () => true);
  const telegramAnswerCbQuery = jest.fn(async () => true);
  const editMessageText = jest.fn(async () => ({ message_id: messageId }));
  const editMessageReplyMarkup = jest.fn(async () => ({ message_id: messageId }));
  const reply = jest.fn(async () => ({ message_id: messageId + 1 }));

  const ctx = {
    from: { id: userId, first_name: opts.firstName ?? 'Test', is_bot: false },
    chat: { id: chatId, type: 'private' as const },
    answerCbQuery,
    telegram: { answerCbQuery: telegramAnswerCbQuery },
    editMessageText,
    editMessageReplyMarkup,
    reply,
    scene: { leave: jest.fn(async () => undefined) },
  } as Record<string, unknown>;

  if (opts.data) {
    ctx.callbackQuery = {
      id: 'cb_test',
      data: opts.data,
      message: {
        message_id: messageId,
        date: Math.floor(Date.now() / 1000),
        chat: { id: chatId, type: 'private' },
        text: '\u200b',
      },
    };
  }

  return ctx as Context & {
    answerCbQuery: typeof answerCbQuery;
    telegram: { answerCbQuery: typeof telegramAnswerCbQuery };
    editMessageText: typeof editMessageText;
    editMessageReplyMarkup: typeof editMessageReplyMarkup;
    reply: typeof reply;
  };
}
