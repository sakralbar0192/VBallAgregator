import { Markup } from 'telegraf';
import { BaseStep } from '../base-step.js';
import DayTimeService from '../services/day-time.js';
import WeekDayService from '../services/week-day.js';
import type { ProfileSetupWizardContext as Context, DayTime, DayTimeAction, WeekDay } from '../types.js';

function pickCurrentDay(
  ctx: Context,
  selectedDays: WeekDay[],
  dayTimes: Record<WeekDay, DayTime[]>,
  reset: boolean,
): WeekDay | undefined {
  if (reset) {
    ctx.wizard.state.dayTimeCursorDay = undefined;
  }
  const cursor = ctx.wizard.state.dayTimeCursorDay;
  if (!reset && cursor && selectedDays.includes(cursor)) {
    return cursor;
  }
  return selectedDays.find(day => !dayTimes[day]?.length);
}

export class DayTimeStep extends BaseStep {
  async execute(ctx: Context) {
    if (!ctx.wizard.state.dayTimes) {
      ctx.wizard.state.dayTimes = {} as Record<WeekDay, DayTime[]>;
    }
    const selectedDays: WeekDay[] = ctx.wizard.state.selectedDays || [];
    const dayTimes = ctx.wizard.state.dayTimes as Record<WeekDay, DayTime[]>;
    const currentDay = pickCurrentDay(ctx, selectedDays, dayTimes, false);

    if (!currentDay) {
      await ctx.answerCbQuery('Выберите хотя бы один день!');
      ctx.wizard.back();
    } else {
      ctx.wizard.state.dayTimeCursorDay = currentDay;
      await this.replyOrEdit(
        ctx,
        `⏰ ${WeekDayService.daysOfWeek[currentDay].name} - выберите время для игры  (можно несколько):`,
        Markup.inlineKeyboard(DayTimeService.getDaysKeyboard(dayTimes[currentDay] as DayTime[])),
      );
    }
  }

  async handleInput(ctx: Context, action: DayTimeAction) {
    const dayTimes = ctx.wizard.state.dayTimes as Record<WeekDay, DayTime[]>;
    const selectedDays: WeekDay[] = ctx.wizard.state.selectedDays || [];
    let currentDay = pickCurrentDay(ctx, selectedDays, dayTimes, false);
    if (!currentDay) {
      await ctx.answerCbQuery('Выберите хотя бы один день!');
      ctx.wizard.back();
    } else {
      if (!dayTimes[currentDay]) dayTimes[currentDay] = [];

      if (action === 'day-time_done') {
        if (!dayTimes[currentDay]?.length) {
          await ctx.answerCbQuery('Выберите подходящее время!');
        } else {
          currentDay = pickCurrentDay(ctx, selectedDays, dayTimes, true);
          if (currentDay) {
            ctx.wizard.state.dayTimeCursorDay = currentDay;
            await ctx.answerCbQuery();
          } else {
            await ctx.answerCbQuery();
            return true;
          }
        }
      } else {
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
  }
}
