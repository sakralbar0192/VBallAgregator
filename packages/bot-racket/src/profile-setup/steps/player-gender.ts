import { Markup } from 'telegraf';
import { BaseStep } from '../base-step.js';
import PlayerGenderService from '../services/player-gender.js';
import type { ProfileSetupWizardContext as Context, PlayerGender, PlayerGenderAction } from '../types.js';
import turnDataIntoAction from '../utils/turn-data-into-action.js';

export class PlayerGenderStep extends BaseStep {
  async execute(ctx: Context) {
    await this.replyOrEdit(
      ctx,
      '🧑🤝👧 Выберите ваш пол',
      Markup.inlineKeyboard(
        PlayerGenderService.playerGenderEntries.map(([key, gender]) => [
          Markup.button.callback(gender.shortName, turnDataIntoAction(key, PlayerGenderService.playerGenderStepName)),
        ]),
      ),
    );
  }

  async handleInput(ctx: Context, action: PlayerGenderAction) {
    const playerGender = this.stripActionPayload(action, PlayerGenderService.playerGenderStepName) as PlayerGender;
    if (PlayerGenderService.isLevelValid(playerGender)) {
      ctx.wizard.state.gender = playerGender;
      await ctx.answerCbQuery();
      return true;
    }
    await ctx.answerCbQuery('Неподходящее значение для пола!');
  }
}
