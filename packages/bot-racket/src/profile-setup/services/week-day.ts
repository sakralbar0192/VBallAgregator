import { Markup } from 'telegraf';
import type { WeekDay, WeekDayAction, WeekDayStepName } from '../types.js';
import type { EntityInfo } from '../step-wizard-types.js';
import turnDataIntoAction from '../utils/turn-data-into-action.js';
import { TENNIS_PROFILE_WIZARD_BACK_CB, TennisStepAction } from '../tennis-callbacks.js';
import { TennisText } from '../tennis-text.js';

export default class WeekDayService {
  static WeekDayStepName: WeekDayStepName = 'week-day';

  static daysOfWeek: Record<WeekDay, EntityInfo> = {
    monday: { name: 'понедельник', shortName: 'Пн' },
    tuesday: { name: 'вторник', shortName: 'Вт' },
    wednesday: { name: 'среда', shortName: 'Ср' },
    thursday: { name: 'четверг', shortName: 'Чт' },
    friday: { name: 'пятница', shortName: 'Пт' },
    saturday: { name: 'суббота', shortName: 'Сб' },
    sunday: { name: 'воскресенье', shortName: 'Вс' },
  };

  static getDaysKeyboard(selectedDays: WeekDay[] = []) {
    const keyboardStructure: WeekDay[][] = [
      ['monday', 'tuesday'],
      ['wednesday', 'thursday'],
      ['friday', 'saturday'],
      ['sunday'],
    ];

    function createDayButton(weekDay: WeekDay): [string, WeekDayAction] {
      const label = `${selectedDays.includes(weekDay) ? '✅' : ''} ${WeekDayService.daysOfWeek[weekDay].shortName}`;
      return [label, turnDataIntoAction(weekDay, WeekDayService.WeekDayStepName) as WeekDayAction];
    }

    const daysKeyboard = keyboardStructure.map(row =>
      row.map(weekDay => Markup.button.callback(...createDayButton(weekDay))),
    );
    daysKeyboard.push([Markup.button.callback(TennisText.done, TennisStepAction.weekDayDone)]);
    daysKeyboard.push([Markup.button.callback(TennisText.back, TENNIS_PROFILE_WIZARD_BACK_CB)]);
    return daysKeyboard;
  }

  static getReadableWeekDayInfo(selectedDays: WeekDay[]) {
    return selectedDays.map(weekDay => WeekDayService.daysOfWeek[weekDay].name).join(', ');
  }
}
