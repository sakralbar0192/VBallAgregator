import { Markup } from 'telegraf';
import { BaseStep } from '../base-step.js';
import PlayLevelService from '../services/play-level.js';
import type { ProfileSetupWizardContext as Context, PlayLevel, PlayLevelAction } from '../types.js';
import turnDataIntoAction from '../utils/turn-data-into-action.js';
import { TennisText } from '../tennis-text.js';

export class PlayLevelStep extends BaseStep {
  override isFirstStep = true;

  async execute(ctx: Context) {
    if (!ctx.wizard.state.level) {
      ctx.wizard.state.level = PlayLevelService.defaultLevel;
    }

    const cur = ctx.wizard.state.level;
    const rows = PlayLevelService.playLevelEntries.map(([key, level]) => [
      Markup.button.callback(
        `${cur === key ? '✅ ' : ''}${level}`,
        turnDataIntoAction(key, PlayLevelService.playLevelStepName),
      ),
    ]);
    await this.replyOrEdit(ctx, TennisText.playLevel, Markup.inlineKeyboard(rows));
  }

  async handleInput(ctx: Context, action: PlayLevelAction) {
    const playLevel = this.stripActionPayload(action, PlayLevelService.playLevelStepName) as PlayLevel;
    if (PlayLevelService.isLevelValid(playLevel)) {
      ctx.wizard.state.level = playLevel;
      await ctx.answerCbQuery();
      return true;
    }
    await ctx.answerCbQuery(TennisText.errInvalidLevel);
  }
}
