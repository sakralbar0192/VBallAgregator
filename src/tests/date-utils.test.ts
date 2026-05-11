import { describe, it, expect } from '@jest/globals';
import {
  formatGameTime,
  formatGameTimeForNotification,
  getDefaultUserPreferences,
  getUserTimezone,
  getUserLocale,
  getCurrentTimeInTimezone,
  isTodayInTimezone,
  getMinGameStartTime,
  convertUserTimeToUTC,
  formatDateForButton,
} from '../shared/date-utils.js';

describe('date-utils', () => {
  const sample = new Date('2026-06-15T12:00:00.000Z');

  it('formats game time', () => {
    expect(formatGameTime(sample, 'Asia/Irkutsk', 'ru-RU')).toBeTruthy();
    expect(formatGameTimeForNotification(sample)).toBeTruthy();
  });

  it('returns defaults and user prefs helpers', () => {
    const p = getDefaultUserPreferences();
    expect(p.timezone).toBeTruthy();
    expect(p.locale).toBeTruthy();
    expect(getUserTimezone('u')).toBe(p.timezone);
    expect(getUserLocale('u')).toBe(p.locale);
  });

  it('timezone helpers return Dates', () => {
    const tz = 'Asia/Irkutsk';
    expect(getCurrentTimeInTimezone(tz)).toBeInstanceOf(Date);
    expect(getMinGameStartTime(tz)).toBeInstanceOf(Date);
    expect(convertUserTimeToUTC(sample, tz)).toBeInstanceOf(Date);
    expect(typeof isTodayInTimezone(sample, tz)).toBe('boolean');
  });

  it('formatDateForButton', () => {
    expect(formatDateForButton(sample)).toBeTruthy();
  });
});
