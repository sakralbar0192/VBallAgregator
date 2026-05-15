import { Context } from 'telegraf';
import { BaseHandler } from '../common/base-handler.js';
import { OnboardingHandlers } from './onboarding-handlers.js';

/**
 * Обработчик регистрации пользователей
 */
export class RegistrationHandler extends BaseHandler {
  /**
   * Обработчик команды /start — мультиспорт-онбординг и возвратные сценарии
   */
  static async handleStart(ctx: Context): Promise<void> {
    await OnboardingHandlers.handleStart(ctx);
  }
}
