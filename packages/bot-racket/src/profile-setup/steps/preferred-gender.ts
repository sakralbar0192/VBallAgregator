import { Markup } from 'telegraf';
import { BaseStep } from '../base-step.js';
import PreferredGenderService from '../services/prefer-gender.js';
import type { ProfileSetupWizardContext as Context, PreferredGender, PreferredGenderAction } from '../types.js';
import { TennisStepAction } from '../tennis-callbacks.js';
import { TennisText } from '../tennis-text.js';

export class PreferredGenderStep extends BaseStep {
  async execute(ctx: Context) {
    if (!ctx.wizard.state.preferGenders) {
      ctx.wizard.state.preferGenders = [];
    }

    await this.replyOrEdit(
      ctx,
      TennisText.preferredGender,
      Markup.inlineKeyboard(
        PreferredGenderService.getGendersKeyboard(ctx.wizard.state.preferGenders as PreferredGender[]),
      ),
    );
  }

  async handleInput(ctx: Context, action: PreferredGenderAction) {
    if (action === TennisStepAction.preferredGenderDone) {
      if (
        !ctx.wizard.state.preferGenders?.length ||
        PreferredGenderService.preferredGenderKeys.every(g =>
          ctx.wizard.state.preferGenders?.includes(g),
        )
      ) {
        ctx.wizard.state.preferGenders = ['all'];
      }
      await ctx.answerCbQuery();
      return true;
    }
    const preferredGender = this.stripActionPayload(
      action,
      PreferredGenderService.PreferredGenderStepName,
    ) as PreferredGender;
    if (ctx.wizard.state.preferGenders?.includes(preferredGender)) {
      ctx.wizard.state.preferGenders = ctx.wizard.state.preferGenders.filter(gender => gender !== preferredGender);
    } else {
      ctx.wizard.state.preferGenders?.push(preferredGender);
    }
    await ctx.answerCbQuery();
  }
}
