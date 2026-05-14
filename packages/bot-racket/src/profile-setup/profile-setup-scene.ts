import { WizardScene } from 'telegraf/scenes';
import type { ProfileSetupActions, ProfileSetupWizardContext } from './types.js';
import { profileSetupStepFactory } from './profile-setup-step-factory.js';

/** Сцена полного мастера профиля для подбора (id совпадает с `scene.enter` в регистрации). */
export function createRacketProfileWizardScene(): WizardScene<ProfileSetupWizardContext> {
  return new WizardScene<ProfileSetupWizardContext>(
    'racket-profile',
    async ctx => {
      await profileSetupStepFactory.execute(ctx, profileSetupStepFactory.defaultStep);
      return ctx.wizard.next();
    },
    async (ctx, next) => {
      if (ctx.callbackQuery && 'data' in ctx.callbackQuery) {
        const nextStep = await profileSetupStepFactory.handle(
          ctx,
          ctx.callbackQuery.data as ProfileSetupActions,
        );
        if (nextStep) {
          await profileSetupStepFactory.execute(ctx, nextStep);
        } else {
          try {
            await profileSetupStepFactory.finalizeFunction(ctx);
          } finally {
            await ctx.scene.leave();
          }
        }
        return;
      }
      // Wizard middleware получает (ctx, next); без next() текст и команды не доходят до bot.command / hears.
      return next();
    },
  );
}
