import { Markup } from 'telegraf';
import { BaseStep } from '../base-step.js';
import {
  getSelectedDaysOrdered,
  nextDayInWalk,
  resolveDayTimeCursor,
} from '../day-time-walk.js';
import DayTimeService from '../services/day-time.js';
import WeekDayService from '../services/week-day.js';
import type { ProfileSetupWizardContext as Context, DayTime, DayTimeAction, WeekDay } from '../types.js';
import { TennisText } from '../tennis-text.js';
import { TennisStepAction } from '../tennis-callbacks.js';

export class DayTimeStep extends BaseStep {
  async execute(ctx: Context) {
    if (!ctx.wizard.state.dayTimes) {
      ctx.wizard.state.dayTimes = {} as Record<WeekDay, DayTime[]>;
    }
    const ordered = getSelectedDaysOrdered(ctx);
    const currentDay = resolveDayTimeCursor(ctx, ordered);

    if (!currentDay) {
      await ctx.answerCbQuery(TennisText.errPickWeekDay);
      return;
    }

    const dayTimes = ctx.wizard.state.dayTimes as Record<WeekDay, DayTime[]>;
    await this.replyOrEdit(
      ctx,
      TennisText.dayTime(WeekDayService.daysOfWeek[currentDay].name),
      Markup.inlineKeyboard(DayTimeService.getDaysKeyboard(dayTimes[currentDay] ?? [])),
    );
  }

  async handleInput(ctx: Context, action: DayTimeAction) {
    const ordered = getSelectedDaysOrdered(ctx);
    const currentDay = resolveDayTimeCursor(ctx, ordered);
    if (!currentDay) {
      await ctx.answerCbQuery(TennisText.errPickWeekDay);
      return;
    }

    const dayTimes = ctx.wizard.state.dayTimes as Record<WeekDay, DayTime[]>;
    if (!dayTimes[currentDay]) dayTimes[currentDay] = [];

    if (action === TennisStepAction.dayTimeDone) {
      if (!dayTimes[currentDay]?.length) {
        await ctx.answerCbQuery(TennisText.errPickTime);
        return;
      }
      const nextDay = nextDayInWalk(ordered, currentDay);
      if (nextDay) {
        ctx.wizard.state.dayTimeCursorDay = nextDay;
        await ctx.answerCbQuery();
        return;
      }
      await ctx.answerCbQuery();
      return true;
    }

    const dayTime = this.stripActionPayload(action, DayTimeService.DayTimeStepName) as DayTime;
    if (dayTimes[currentDay]?.includes(dayTime)) {
      dayTimes[currentDay] = dayTimes[currentDay].filter(time => time !== dayTime);
    } else {
      dayTimes[currentDay]?.push(dayTime);
    }
    ctx.wizard.state.dayTimes = dayTimes;
    await ctx.answerCbQuery();
  }
}
