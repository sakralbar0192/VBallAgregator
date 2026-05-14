import { Markup } from 'telegraf';
import { BaseStep } from '../base-step.js';
import PreferredAgeService from '../services/prefer-age.js';
import type { ProfileSetupWizardContext as Context, PreferredAge, PreferredAgeAction } from '../types.js';

export class PreferredAgeStep extends BaseStep {
  async execute(ctx: Context) {
    if (!ctx.wizard.state.preferAges) {
      ctx.wizard.state.preferAges = [];
    }

    await this.replyOrEdit(
      ctx,
      '🧓 Выберите предпочтительный возраст оппонентов',
      Markup.inlineKeyboard(PreferredAgeService.getAgesKeyboard(ctx.wizard.state.preferAges as PreferredAge[])),
    );
  }

  async handleInput(ctx: Context, action: PreferredAgeAction) {
    if (action === 'preferred-age_done') {
      if (
        !ctx.wizard.state.preferAges?.length ||
        PreferredAgeService.preferredAgeKeys.every(age => ctx.wizard.state.preferAges?.includes(age))
      ) {
        ctx.wizard.state.preferAges = ['all'];
      }

      await ctx.answerCbQuery();
      return true;
    }
    const preferredAge = this.stripActionPayload(action, PreferredAgeService.PreferredAgeStepName) as PreferredAge;
    if (ctx.wizard.state.preferAges?.includes(preferredAge)) {
      ctx.wizard.state.preferAges = ctx.wizard.state.preferAges.filter(age => age !== preferredAge);
    } else {
      ctx.wizard.state.preferAges?.push(preferredAge);
    }
    await ctx.answerCbQuery();
  }
}
