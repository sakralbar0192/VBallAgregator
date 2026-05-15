import { Telegraf } from 'telegraf';
import type { Context } from 'telegraf';
import { IBotModule } from './bot-module-registry.js';
import { RegistrationHandler } from '../registration/index.js';
import { OrganizerSelectionHandler } from '../settings/index.js';
import { OnboardingHandlers } from '../registration/onboarding-handlers.js';
import { OnbCallback, OnbCallbackPattern } from '../registration/onboarding-callbacks.js';

/**
 * Модуль регистрации пользователей (мультиспорт-онбординг)
 */
export class RegistrationModule implements IBotModule {
  name = 'RegistrationModule';

  async register(bot: Telegraf<Context>): Promise<void> {
    bot.start(RegistrationHandler.handleStart);

    bot.action(OnbCallback.sportToggleVolleyball, OnboardingHandlers.handleToggleVolleyball);
    bot.action(OnbCallback.sportToggleTennis, OnboardingHandlers.handleToggleTennis);
    bot.action(OnbCallback.sportDone, OnboardingHandlers.handleSportsDone);

    bot.action(OnbCallback.demoGenderMen, ctx => OnboardingHandlers.handleDemoGender(ctx, 'men'));
    bot.action(OnbCallback.demoGenderWomen, ctx => OnboardingHandlers.handleDemoGender(ctx, 'women'));
    bot.action(OnbCallbackPattern.demoAge, async ctx => {
      const m = ctx.match[1];
      if (m) await OnboardingHandlers.handleDemoAge(ctx, m);
    });

    bot.action(OnbCallbackPattern.vbFormat, async ctx => {
      const k = ctx.match[1] as 'classic' | 'beach';
      await OnboardingHandlers.vbFormatToggle(ctx, k);
    });
    bot.action(OnbCallback.vbFormatDone, OnboardingHandlers.vbFormatsDone);
    bot.action(OnbCallback.vbWizardBack, OnboardingHandlers.vbWizardBack);
    bot.action(OnbCallbackPattern.vbLevel, async ctx => {
      const k = ctx.match[1];
      if (k) await OnboardingHandlers.vbLevel(ctx, k);
    });
    bot.action(OnbCallbackPattern.vbWeekDay, async ctx => {
      const data = (ctx.callbackQuery as { data?: string }).data;
      if (data) await OnboardingHandlers.vbWeekToggle(ctx, data);
    });
    bot.action(OnbCallbackPattern.vbTime, async ctx => {
      const data = (ctx.callbackQuery as { data?: string }).data;
      if (data) await OnboardingHandlers.vbTimeToggle(ctx, data);
    });
    bot.action(OnbCallback.vbOrgYes, ctx => OnboardingHandlers.vbOrganize(ctx, true));
    bot.action(OnbCallback.vbOrgNo, ctx => OnboardingHandlers.vbOrganize(ctx, false));

    bot.action(OnbCallbackPattern.returningSport, async ctx => {
      const s = ctx.match[1] as 'volleyball' | 'tennis';
      await OnboardingHandlers.handleReturningPick(ctx, s);
    });
    bot.action(OnbCallback.partialEdit, OnboardingHandlers.handlePartialEdit);
    bot.action(OnbCallback.partialAdd, OnboardingHandlers.handlePartialAdd);

    bot.action(OnbCallback.selectOrganizersRegistration, OrganizerSelectionHandler.handleSelectOrganizersRegistration);
  }
}
