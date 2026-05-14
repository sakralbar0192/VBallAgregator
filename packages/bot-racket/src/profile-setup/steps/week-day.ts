import { Markup } from 'telegraf';
import { BaseStep } from '../base-step.js';
import WeekDayService from '../services/week-day.js';
import type { ProfileSetupWizardContext as Context, WeekDay, WeekDayAction } from '../types.js';

export class WeekDayStep extends BaseStep {
  async execute(ctx: Context) {
    if (!ctx.wizard.state.selectedDays) {
      ctx.wizard.state.selectedDays = [];
    }

    await this.replyOrEdit(
      ctx,
      '📅 Выберите дни для игры (можно несколько):',
      Markup.inlineKeyboard(WeekDayService.getDaysKeyboard(ctx.wizard.state.selectedDays)),
    );
  }

  async handleInput(ctx: Context, action: WeekDayAction) {
    let selectedDays = ctx.wizard.state.selectedDays as WeekDay[];

    if (action === 'week-day_done') {
      if (!selectedDays?.length) {
        await ctx.answerCbQuery('Выберите хотя бы один день!');
      } else {
        await ctx.answerCbQuery();
        return true;
      }
    } else {
      const weekDay = this.stripActionPayload(action, WeekDayService.WeekDayStepName) as WeekDay;
      if (selectedDays.includes(weekDay)) {
        selectedDays = selectedDays.filter(day => day !== weekDay);
      } else {
        selectedDays.push(weekDay);
      }
      ctx.wizard.state.selectedDays = selectedDays;
      await ctx.answerCbQuery();
    }
  }
}
