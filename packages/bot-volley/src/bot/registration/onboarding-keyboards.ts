import type { InlineKeyboardButton } from 'telegraf/types';
import type { CatalogSport, DemoGender, VolleyballFormatKey } from './onboarding-constants.js';
import {
  demoAgeCallback,
  demoGenderCallback,
  OnbCallback,
  returningSportCallback,
  vbFormatCallback,
  vbLevelCallback,
  vbWeekDayCallback,
  vbWeekDayDoneCallback,
} from './onboarding-callbacks.js';
import { OnbText } from './onboarding-text.js';

function withCheckmark(selected: boolean, label: string): string {
  return `${selected ? OnbText.checkedPrefix : ''}${label}`;
}

export function sportPickKeyboard(order: CatalogSport[]) {
  const vbOn = order.includes('volleyball');
  const tnOn = order.includes('tennis');
  return {
    inline_keyboard: [
      [{ text: withCheckmark(vbOn, OnbText.sportVolleyball), callback_data: OnbCallback.sportToggleVolleyball }],
      [{ text: withCheckmark(tnOn, OnbText.sportTennis), callback_data: OnbCallback.sportToggleTennis }],
      [{ text: OnbText.sportDone, callback_data: OnbCallback.sportDone }],
    ],
  };
}

export function partialAddSportKeyboard(missing: CatalogSport[], order: CatalogSport[]) {
  return {
    inline_keyboard: [
      ...missing.map(s => [
        {
          text: withCheckmark(
            order.includes(s),
            s === 'tennis' ? OnbText.sportTennis : OnbText.sportVolleyball,
          ),
          callback_data: s === 'tennis' ? OnbCallback.sportToggleTennis : OnbCallback.sportToggleVolleyball,
        },
      ]),
      [{ text: OnbText.sportDone, callback_data: OnbCallback.sportDone }],
    ],
  };
}

export function returningFullKeyboard() {
  return {
    inline_keyboard: [
      [{ text: OnbText.editVolleyball, callback_data: OnbCallback.returningEditVolleyball }],
      [{ text: OnbText.editTennis, callback_data: OnbCallback.returningEditTennis }],
    ],
  };
}

export function returningPartialKeyboard() {
  return {
    inline_keyboard: [
      [{ text: OnbText.partialEditProfile, callback_data: OnbCallback.partialEdit }],
      [{ text: OnbText.partialAddSport, callback_data: OnbCallback.partialAdd }],
    ],
  };
}

export function demoGenderKeyboard() {
  return {
    inline_keyboard: [
      [{ text: OnbText.demoGenderMen, callback_data: demoGenderCallback('men') }],
      [{ text: OnbText.demoGenderWomen, callback_data: demoGenderCallback('women') }],
    ],
  };
}

export function demoAgeKeyboard() {
  return {
    inline_keyboard: [
      [{ text: OnbText.demoAgeBefore20, callback_data: demoAgeCallback('before-twenty') }],
      [{ text: OnbText.demoAge2030, callback_data: demoAgeCallback('after-twenty-before-thirty') }],
      [{ text: OnbText.demoAge30Plus, callback_data: demoAgeCallback('after-thirty') }],
    ],
  };
}

export function returningEditSportKeyboard(completed: CatalogSport[]) {
  return {
    inline_keyboard: completed.map(s => [
      {
        text: s === 'tennis' ? OnbText.sportLabelTennis : OnbText.sportLabelVolleyball,
        callback_data: returningSportCallback(s),
      },
    ]),
  };
}

export function vbOrganizeKeyboard(wantOrganize: boolean | undefined) {
  const yesMark = wantOrganize === true ? OnbText.checkedPrefix : '';
  const noMark = wantOrganize === false ? OnbText.checkedPrefix : '';
  return {
    inline_keyboard: [
      [{ text: `${yesMark}${OnbText.vbYes}`, callback_data: OnbCallback.vbOrgYes }],
      [{ text: `${noMark}${OnbText.vbNo}`, callback_data: OnbCallback.vbOrgNo }],
      [{ text: OnbText.back, callback_data: OnbCallback.vbWizardBack }],
    ],
  };
}

export function vbFormatsKeyboardRow(key: VolleyballFormatKey, selected: boolean): InlineKeyboardButton {
  const labels: Record<VolleyballFormatKey, string> = {
    classic: 'Классика',
    beach: 'Пляжный',
  };
  return {
    text: withCheckmark(selected, labels[key]),
    callback_data: vbFormatCallback(key),
  };
}

export function vbLevelKeyboardRow(key: string, label: string, selected: boolean): InlineKeyboardButton {
  return {
    text: withCheckmark(selected, label),
    callback_data: vbLevelCallback(key),
  };
}

export function vbWeekDayDoneButton(): InlineKeyboardButton {
  return { text: OnbText.done, callback_data: vbWeekDayDoneCallback() };
}

export function vbWeekDayButton(shortName: string, day: string, selected: boolean): InlineKeyboardButton {
  return {
    text: withCheckmark(selected, shortName),
    callback_data: vbWeekDayCallback(day),
  };
}
