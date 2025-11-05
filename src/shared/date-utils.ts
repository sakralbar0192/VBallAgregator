/**
 * Утилиты для работы с датами и локализацией
 */

export interface UserPreferences {
  timezone: string;
  locale: string;
}

/**
 * Форматирует время игры с учетом часового пояса пользователя
 */
export function formatGameTime(date: Date, userTz: string = 'Asia/Irkutsk', locale: string = 'ru-RU'): string {
  return date.toLocaleDateString(locale, {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: userTz
  });
}

/**
 * Форматирует время игры для уведомлений
 */
export function formatGameTimeForNotification(date: Date, userTz?: string): string {
  return formatGameTime(date, userTz);
}

/**
 * Получает настройки пользователя по умолчанию
 */
export function getDefaultUserPreferences(): UserPreferences {
  return {
    timezone: process.env.DEFAULT_TIMEZONE || 'Asia/Irkutsk',
    locale: process.env.DEFAULT_LOCALE || 'ru-RU'
  };
}

/**
 * Получает часовой пояс пользователя (пока возвращает дефолтный)
 * В будущем можно расширить для хранения в БД
 */
export function getUserTimezone(userId: string): string {
  // TODO: Получать из БД или кеша настроек пользователя
  return getDefaultUserPreferences().timezone;
}

/**
 * Получает локаль пользователя (пока возвращает дефолтную)
 */
export function getUserLocale(userId: string): string {
  // TODO: Получать из БД или кеша настроек пользователя
  return getDefaultUserPreferences().locale;
}

/**
 * Получает текущее время в указанном часовом поясе
 */
export function getCurrentTimeInTimezone(timezone: string): Date {
  const now = new Date();
  // Конвертируем текущее UTC время в указанный TZ
  const timeString = now.toLocaleString('en-US', { timeZone: timezone });
  return new Date(timeString);
}

/**
 * Проверяет, является ли дата "сегодня" в указанном часовом поясе
 */
export function isTodayInTimezone(date: Date, timezone: string): boolean {
  const nowInTz = getCurrentTimeInTimezone(timezone);
  const dateInTz = new Date(date.toLocaleString('en-US', { timeZone: timezone }));

  return dateInTz.toDateString() === nowInTz.toDateString();
}

/**
 * Получает минимальное время начала игры (текущее время + 4 часа) в пользовательском TZ
 * Возвращает Date объект, где getHours() вернет часы в пользовательском TZ
 */
export function getMinGameStartTime(timezone: string): Date {
  const nowInTz = getCurrentTimeInTimezone(timezone);
  const minTimeInTz = new Date(nowInTz.getTime() + 4 * 60 * 60 * 1000);
  // Конвертируем обратно в строку и парсим, чтобы getHours() работал корректно
  const timeString = minTimeInTz.toLocaleString('en-US', { timeZone: timezone });
  return new Date(timeString);
}

/**
 * Конвертирует время из пользовательского TZ в UTC для хранения в БД
 */
export function convertUserTimeToUTC(userTime: Date, userTimezone: string): Date {
  // Создаем строку в формате ISO с TZ пользователя
  const userTimeString = userTime.toLocaleString('en-US', {
    timeZone: userTimezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });

  // Парсим обратно в Date (будет в UTC)
  return new Date(userTimeString);
}

/**
 * Форматирует дату для кнопок: числами, год только если отличается от текущего
 */
export function formatDateForButton(date: Date, userTz: string = 'Asia/Irkutsk'): string {
  const now = new Date();
  const gameDate = new Date(date.toLocaleString('en-US', { timeZone: userTz }));

  const currentYear = now.getFullYear();
  const gameYear = gameDate.getFullYear();

  const options: Intl.DateTimeFormatOptions = {
    day: 'numeric',
    month: 'numeric',
    ...(gameYear !== currentYear && { year: '2-digit' }),
    hour: '2-digit',
    minute: '2-digit',
    timeZone: userTz
  };

  return gameDate.toLocaleDateString('ru-RU', options);
}