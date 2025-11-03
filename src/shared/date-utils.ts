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