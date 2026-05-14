import { Markup } from 'telegraf';
import { BaseStep } from '../base-step.js';
import PlayerAgeService from '../services/player-age.js';
import type { ProfileSetupWizardContext as Context, PlayerAge, PlayerAgeAction } from '../types.js';
import turnDataIntoAction from '../utils/turn-data-into-action.js';

export class PlayerAgeStep extends BaseStep {
  async execute(ctx: Context) {
    await this.replyOrEdit(
      ctx,
      '🧓 Выберите вашу возрастную категорию',
      Markup.inlineKeyboard(
        PlayerAgeService.playerAgeEntries.map(([key, age]) => [
          Markup.button.callback(age.shortName, turnDataIntoAction(key, PlayerAgeService.playerAgeStepName)),
        ]),
      ),
    );
  }

  async handleInput(ctx: Context, action: PlayerAgeAction) {
    const playerAge = this.stripActionPayload(action, PlayerAgeService.playerAgeStepName) as PlayerAge;
    if (PlayerAgeService.isLevelValid(playerAge)) {
      ctx.wizard.state.age = playerAge;
      await ctx.answerCbQuery();
      return true;
    }
    await ctx.answerCbQuery('Неподходящее значение для возраста!');
  }
}
