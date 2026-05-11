import type { Update } from 'telegraf/types';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const ApiClient = require('telegraf/lib/core/network/client.js').default as {
  prototype: { callApi: (...args: unknown[]) => Promise<unknown> };
};

export type ApiCallRecord = {
  method: string;
  payload: Record<string, unknown>;
  response?: unknown;
};

let messageIdSeq = 1;
let originalCallApi: typeof ApiClient.prototype.callApi | undefined;

/**
 * Подмена Telegraf ApiClient.callApi глобально: каждый Update создаёт новый Telegram-клиент,
 * поэтому недостаточно патчить только bot.telegram.callApi.
 */
export function patchTelegramApiClient(store: { calls: ApiCallRecord[] }): () => void {
  if (!originalCallApi) {
    originalCallApi = ApiClient.prototype.callApi;
  }

  ApiClient.prototype.callApi = (async function patchedCallApi(
    method: string,
    payload: object,
    extra?: { signal?: AbortSignal }
  ) {
    void extra;
    const p = payload as Record<string, unknown>;
    let response: unknown;
    switch (method) {
      case 'getMe':
        response = {
          id: 1000000,
          is_bot: true,
          first_name: 'E2E',
          username: 'e2e_bot',
          can_join_groups: true,
          can_read_all_group_messages: false,
          supports_inline_queries: false,
        };
        break;
      case 'sendMessage': {
        const mid = messageIdSeq++;
        response = {
          message_id: mid,
          date: Math.floor(Date.now() / 1000),
          chat: { id: Number(p.chat_id), type: 'private' },
          from: { id: 1000000, is_bot: true, first_name: 'E2E' },
          text: typeof p.text === 'string' ? p.text : '',
        };
        break;
      }
      case 'editMessageText':
        response = {
          message_id: Number(p.message_id),
          date: Math.floor(Date.now() / 1000),
          chat: { id: Number(p.chat_id), type: 'private' },
          text: typeof p.text === 'string' ? p.text : '',
        };
        break;
      case 'answerCallbackQuery':
        response = true;
        break;
      default:
        response = {};
    }
    store.calls.push({ method, payload: p, response });
    return response;
  }) as typeof ApiClient.prototype.callApi;

  return () => {
    if (originalCallApi) {
      ApiClient.prototype.callApi = originalCallApi;
    }
  };
}

export function resetTelegramHarnessSeq(): void {
  messageIdSeq = 1;
}

export function buildPrivateMessageUpdate(opts: {
  updateId: number;
  chatId: number;
  userId: number;
  text: string;
  firstName?: string;
}): Update {
  const cmdMatch = opts.text.match(/^\/\w+/);
  const cmdLen = cmdMatch ? cmdMatch[0].length : 0;
  return {
    update_id: opts.updateId,
    message: {
      message_id: opts.updateId + 10000,
      date: Math.floor(Date.now() / 1000),
      chat: { id: opts.chatId, type: 'private', first_name: opts.firstName ?? 'User' },
      from: {
        id: opts.userId,
        is_bot: false,
        first_name: opts.firstName ?? 'User',
      },
      text: opts.text,
      ...(cmdLen > 0
        ? { entities: [{ offset: 0, length: cmdLen, type: 'bot_command' as const }] }
        : {}),
    },
  };
}

export function buildCallbackUpdate(opts: {
  updateId: number;
  chatId: number;
  userId: number;
  messageId: number;
  data: string;
  firstName?: string;
}): Update {
  return {
    update_id: opts.updateId,
    callback_query: {
      id: `cb_${opts.updateId}`,
      chat_instance: '1',
      from: {
        id: opts.userId,
        is_bot: false,
        first_name: opts.firstName ?? 'User',
      },
      message: {
        message_id: opts.messageId,
        date: Math.floor(Date.now() / 1000),
        chat: {
          id: opts.chatId,
          type: 'private',
          first_name: opts.firstName ?? 'User',
        },
        text: '\u200b',
      },
      data: opts.data,
    },
  };
}

