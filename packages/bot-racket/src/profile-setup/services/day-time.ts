import { Markup } from 'telegraf';
import WeekDayService from './week-day.js';
import type { DayTime, DayTimeAction, DayTimeStepName, WeekDay } from '../types.js';
import turnDataIntoAction from '../utils/turn-data-into-action.js';

export default class DayTimeService {
  static DayTimeStepName: DayTimeStepName = 'day-time';

  static timeOfDay: Record<DayTime, string> = {
    'nine-am': '09:00',
    'ten-am': '10:00',
    'eleven-am': '11:00',
    'twelve-am': '12:00',
    'thirteen-pm': '13:00',
    'fourteen-pm': '14:00',
    'fifteen-pm': '15:00',
    'sixteen-pm': '16:00',
    'seventeen-pm': '17:00',
    'eighteen-pm': '18:00',
    'nineteen-pm': '19:00',
    'twenty-pm': '20:00',
  };

  static getDaysKeyboard(selectedTimes: DayTime[] = []) {
    const keyboardStructure: DayTime[][] = [
      ['nine-am', 'ten-am', 'eleven-am'],
      ['twelve-am', 'thirteen-pm', 'fourteen-pm'],
      ['fifteen-pm', 'sixteen-pm', 'seventeen-pm'],
      ['eighteen-pm', 'nineteen-pm', 'twenty-pm'],
    ];

    function createTimeButton(dayTime: DayTime): [string, DayTimeAction] {
      const label = `${selectedTimes.includes(dayTime) ? '✅' : ''} ${DayTimeService.timeOfDay[dayTime]}`;
      return [label, turnDataIntoAction(dayTime, DayTimeService.DayTimeStepName) as DayTimeAction];
    }

    const daysKeyboard = keyboardStructure.map(row =>
      row.map(dayTime => Markup.button.callback(...createTimeButton(dayTime))),
    );
    daysKeyboard.push([Markup.button.callback('Готово', 'day-time_done')]);
    return daysKeyboard;
  }

  static getReadableDayTimeInfo(dayTimes: Record<WeekDay, DayTime[]>) {
    return (
      '\n' +
      Object.entries(dayTimes)
        .map(([day, times]) => {
          return (
            `  ${WeekDayService.daysOfWeek[day as WeekDay].name}: \n` +
            `    ${times.map(dayTime => DayTimeService.timeOfDay[dayTime]).join(', ')}`
          );
        })
        .join('\n')
    );
  }
}
