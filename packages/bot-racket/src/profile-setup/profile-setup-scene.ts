import { WizardScene } from 'telegraf/scenes';
import type { ProfileSetupActions, ProfileSetupWizardContext, WizardState } from './types.js';
import { profileSetupStepFactory } from './profile-setup-step-factory.js';
import { applyTennisWizardStateFromDb } from './tennis-wizard-prefill.js';
import { TENNIS_PROFILE_WIZARD_BACK_CB, TENNIS_SCENE_ID } from './tennis-callbacks.js';

/** Сцена мастера профиля большого тенниса (id совпадает с `scene.enter` в регистрации). */
export function createRacketProfileWizardScene(): WizardScene<ProfileSetupWizardContext> {
  return new WizardScene<ProfileSetupWizardContext>(
    TENNIS_SCENE_ID,
    async ctx => {
      // Нельзя делать `ctx.wizard.state = {}`: у Telegraf это отрывает объект от `ctx.scene.state`,
      // данные не попадают в persist-сессию между callback — префилл и шаги «теряются» при редактировании.
      const st = ctx.wizard.state as WizardState & Record<string, unknown>;
      for (const k of Object.keys(st)) {
        delete st[k];
      }
      const telegramId = ctx.from?.id;
      if (telegramId !== undefined) {
        await applyTennisWizardStateFromDb(st, telegramId);
      }
      await profileSetupStepFactory.execute(ctx, profileSetupStepFactory.defaultStep);
      return ctx.wizard.next();
    },
    async (ctx, next) => {
      if (ctx.callbackQuery && 'data' in ctx.callbackQuery) {
        if (ctx.callbackQuery.data === TENNIS_PROFILE_WIZARD_BACK_CB) {
          const r = await profileSetupStepFactory.goBack(ctx);
          if (r === 'at-first') {
            const { TennisText } = await import('./tennis-text.js');
            await ctx.answerCbQuery(TennisText.errWizardAtFirst);
          } else {
            await ctx.answerCbQuery();
          }
          return;
        }
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
