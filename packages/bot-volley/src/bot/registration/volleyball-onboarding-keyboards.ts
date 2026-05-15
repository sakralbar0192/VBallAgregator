import type { InlineKeyboardButton } from 'telegraf/types';
import type { DayTime, WeekDay } from '../../../../bot-racket/src/profile-setup/types.js';
import DayTimeService from '../../../../bot-racket/src/profile-setup/services/day-time.js';
import WeekDayService from '../../../../bot-racket/src/profile-setup/services/week-day.js';
import {
  DAY_TIME_KEYBOARD_ROWS,
  VOLLEYBALL_LEVEL_OPTIONS,
  WEEK_DAY_KEYBOARD_ROWS,
} from './onboarding-constants.js';
import {
  OnbCallback,
  vbLevelCallback,
  vbTimeCallback,
  vbTimeDoneCallback,
  vbWeekDayCallback,
  vbWeekDayDoneCallback,
} from './onboarding-callbacks.js';
import { OnbText } from './onboarding-text.js';
import {
  vbFormatsKeyboardRow,
  vbLevelKeyboardRow,
  vbWeekDayButton,
  vbWeekDayDoneButton,
} from './onboarding-keyboards.js';

export const VOLLEYBALL_WIZARD_BACK_CB = OnbCallback.vbWizardBack;
export const WD_PREFIX = 'onbVB_wd_' as const;
export const TM_PREFIX = 'onbVB_tm_' as const;

const backButton: InlineKeyboardButton = { text: OnbText.back, callback_data: OnbCallback.vbWizardBack };

function appendBackRow(rows: InlineKeyboardButton[][]): InlineKeyboardButton[][] {
  return [...rows, [backButton]];
}

export function volleyballFormatsKeyboard(fmt: { classic: boolean; beach: boolean }): {
  inline_keyboard: InlineKeyboardButton[][];
} {
  return {
    inline_keyboard: [
      [vbFormatsKeyboardRow('classic', fmt.classic), vbFormatsKeyboardRow('beach', fmt.beach)],
      [{ text: OnbText.done, callback_data: OnbCallback.vbFormatDone }],
    ],
  };
}

export function volleyballWeekKeyboard(selected: WeekDay[]): { inline_keyboard: InlineKeyboardButton[][] } {
  const rows = WEEK_DAY_KEYBOARD_ROWS.map(r =>
    r.map(d => {
      const day = d as WeekDay;
      return vbWeekDayButton(WeekDayService.daysOfWeek[day].shortName, day, selected.includes(day));
    }),
  );
  rows.push([vbWeekDayDoneButton()]);
  return { inline_keyboard: appendBackRow(rows) };
}

export function volleyballTimeKeyboardForDay(
  day: WeekDay,
  selected: DayTime[],
): { inline_keyboard: InlineKeyboardButton[][] } {
  const rows = DAY_TIME_KEYBOARD_ROWS.map(r =>
    r.map(t => {
      const slot = t as DayTime;
      const mark = selected.includes(slot) ? OnbText.checkedPrefixShort : '';
      return {
        text: `${mark} ${DayTimeService.timeOfDay[slot]}`,
        callback_data: vbTimeCallback(day, slot),
      };
    }),
  );
  rows.push([{ text: OnbText.doneForDay, callback_data: vbTimeDoneCallback(day) }]);
  return { inline_keyboard: appendBackRow(rows) };
}

export function volleyballLevelKeyboard(selectedKey?: string): { inline_keyboard: InlineKeyboardButton[][] } {
  const inner = VOLLEYBALL_LEVEL_OPTIONS.map(({ key, label }) => [
    vbLevelKeyboardRow(key, label, selectedKey === key),
  ]) as InlineKeyboardButton[][];
  return { inline_keyboard: appendBackRow(inner) };
}
