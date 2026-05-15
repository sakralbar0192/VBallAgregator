import { sortWeekDaysCalendar } from './week-day-calendar.js';
import type { ProfileSetupWizardContext } from './types.js';
import type { DayTime, WeekDay } from './types.js';

/** Выбранные дни в календарном порядке. */
export function getSelectedDaysOrdered(ctx: ProfileSetupWizardContext): WeekDay[] {
  return sortWeekDaysCalendar([...((ctx.wizard.state.selectedDays ?? []) as WeekDay[])]);
}

/** Начать проход по времени с первого выбранного дня. */
export function beginDayTimeWalk(ctx: ProfileSetupWizardContext, ordered: WeekDay[]): WeekDay | undefined {
  if (!ordered.length) return undefined;
  const first = ordered[0]!;
  ctx.wizard.state.dayTimeCursorDay = first;
  return first;
}

/** Текущий день прохода (курсор или первый в списке). */
export function resolveDayTimeCursor(ctx: ProfileSetupWizardContext, ordered: WeekDay[]): WeekDay | undefined {
  if (!ordered.length) return undefined;
  const cursor = ctx.wizard.state.dayTimeCursorDay as WeekDay | undefined;
  if (cursor && ordered.includes(cursor)) return cursor;
  return beginDayTimeWalk(ctx, ordered);
}

/** Следующий день после `currentDay` в проходе; `undefined`, если это был последний. */
export function nextDayInWalk(ordered: WeekDay[], currentDay: WeekDay): WeekDay | undefined {
  const idx = ordered.indexOf(currentDay);
  if (idx < 0 || idx >= ordered.length - 1) return undefined;
  return ordered[idx + 1];
}

/** Удалить из `dayTimes` дни, не входящие в текущий выбор. */
export function pruneDayTimesForSelection(ctx: ProfileSetupWizardContext, ordered: WeekDay[]): void {
  const dt = ctx.wizard.state.dayTimes as Partial<Record<WeekDay, DayTime[]>> | undefined;
  if (!dt) return;
  const keep = new Set(ordered);
  for (const key of Object.keys(dt) as WeekDay[]) {
    if (!keep.has(key)) delete dt[key];
  }
}
