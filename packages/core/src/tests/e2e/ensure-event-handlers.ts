import { EventBus } from '../../shared/event-bus.js';
import { registerEventHandlers } from '../../shared/event-handlers.js';

let handlersRegistered = false;

/** Регистрирует подписчики EventBus один раз (как в index.ts), чтобы уведомления шли через EnhancedNotificationService → Telegram API. */
export async function ensureE2eEventHandlersRegistered(): Promise<void> {
  if (handlersRegistered) {
    return;
  }
  await registerEventHandlers(EventBus.getInstance());
  handlersRegistered = true;
}
