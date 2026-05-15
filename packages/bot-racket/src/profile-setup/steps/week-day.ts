import { Markup } from 'telegraf';
import { BaseStep } from '../base-step.js';
import { beginDayTimeWalk, pruneDayTimesForSelection } from '../day-time-walk.js';
import WeekDayService from '../services/week-day.js';
import { sortWeekDaysCalendar } from '../week-day-calendar.js';
import type { ProfileSetupWizardContext as Context, WeekDay, WeekDayAction } from '../types.js';
import { TennisText } from '../tennis-text.js';
import { TennisStepAction } from '../tennis-callbacks.js';

export class WeekDayStep extends BaseStep {
  async execute(ctx: Context) {
    if (!ctx.wizard.state.selectedDays) {
      ctx.wizard.state.selectedDays = [];
    }

    await this.replyOrEdit(
      ctx,
      TennisText.weekDays,
      Markup.inlineKeyboard(WeekDayService.getDaysKeyboard(ctx.wizard.state.selectedDays)),
    );
  }

  async handleInput(ctx: Context, action: WeekDayAction) {
    let selectedDays = ctx.wizard.state.selectedDays as WeekDay[];

    if (action === TennisStepAction.weekDayDone) {
      if (!selectedDays?.length) {
        await ctx.answerCbQuery(TennisText.errPickWeekDay);
        return;
      }
      const sorted = sortWeekDaysCalendar(selectedDays);
      ctx.wizard.state.selectedDays = sorted;
      pruneDayTimesForSelection(ctx, sorted);
      beginDayTimeWalk(ctx, sorted);
      await ctx.answerCbQuery();
      return true;
    }

    const weekDay = this.stripActionPayload(action, WeekDayService.WeekDayStepName) as WeekDay;
    if (selectedDays.includes(weekDay)) {
      selectedDays = selectedDays.filter(day => day !== weekDay);
      const dt = ctx.wizard.state.dayTimes as Partial<Record<WeekDay, unknown>> | undefined;
      if (dt && weekDay in dt) {
        delete dt[weekDay];
      }
      if (ctx.wizard.state.dayTimeCursorDay === weekDay) {
        ctx.wizard.state.dayTimeCursorDay = undefined;
      }
    } else {
      selectedDays.push(weekDay);
    }
    ctx.wizard.state.selectedDays = selectedDays;
    await ctx.answerCbQuery();
  }
}
