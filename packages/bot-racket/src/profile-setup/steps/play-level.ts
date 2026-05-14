import { Markup } from 'telegraf';
import { BaseStep } from '../base-step.js';
import PlayLevelService from '../services/play-level.js';
import type { ProfileSetupWizardContext as Context, PlayLevel, PlayLevelAction } from '../types.js';
import turnDataIntoAction from '../utils/turn-data-into-action.js';

export class PlayLevelStep extends BaseStep {
  override isFirstStep = true;

  async execute(ctx: Context) {
    if (!ctx.wizard.state.level) {
      ctx.wizard.state.level = PlayLevelService.defaultLevel;
    }

    await this.replyOrEdit(
      ctx,
      '🎾 Выберите ваш уровень игры',
      Markup.inlineKeyboard(
        PlayLevelService.playLevelEntries.map(([key, level]) => [
          Markup.button.callback(level, turnDataIntoAction(key, PlayLevelService.playLevelStepName)),
        ]),
      ),
    );
  }

  async handleInput(ctx: Context, action: PlayLevelAction) {
    const playLevel = this.stripActionPayload(action, PlayLevelService.playLevelStepName) as PlayLevel;
    if (PlayLevelService.isLevelValid(playLevel)) {
      ctx.wizard.state.level = playLevel;
      await ctx.answerCbQuery();
      return true;
    }
    await ctx.answerCbQuery('Неподходящее значение для уровня!');
  }
}
