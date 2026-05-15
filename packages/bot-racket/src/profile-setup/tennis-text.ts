export const TennisText = {
  playLevel: '🎾 Выберите ваш уровень игры',
  preferredGender: '🧑🤝👧 Выберите предпочтительный пол оппонентов',
  preferredAge: '🧓 Выберите предпочтительный возраст оппонентов',
  weekDays: '📅 Выберите дни для игры (можно несколько):',
  dayTime: (dayName: string) =>
    `⏰ ${dayName} - выберите время для игры  (можно несколько):`,

  back: '◀️ Назад',
  done: 'Готово',
  anyGender: '✅ Любой',
  anyAge: '✅ Любой',
  genderDone: 'Готово',
  ageDone: 'Готово',

  errPickWeekDay: 'Выберите хотя бы один день!',
  errPickTime: 'Выберите подходящее время!',
  errInvalidLevel: 'Неподходящее значение для уровня!',
  errWizardAtFirst: 'Это первый шаг — назад некуда.',

  summaryTitle: '✅ Профиль большого тенниса настроен!\n\n',
  summaryPlayerGender: (v: string) => `Твой пол (для подбора): ${v}\n`,
  summaryPlayerAge: (v: string) => `Твой возраст (диапазон): ${v}\n`,
  summaryLevel: (v: string) => `Уровень: ${v}\n`,
  summaryDays: (v: string) => `Дни: ${v}\n`,
  summaryTimes: (v: string) => `Время: ${v}\n`,
  summaryPreferAge: (v: string) => `Предпочтительный возраст партнёров: ${v}\n`,
  summaryPreferGender: (v: string) => `Предпочтительный пол партнёров: ${v}\n`,

  savedStandalone: 'Профиль большого тенниса сохранён. Подбор игр в боте пока в разработке.',
  savedEditToast: 'Профиль тенниса обновлён.',

  errUserNotFound: 'Пользователь не найден. Начни с /start.',
  errIncompleteWizard: 'Не хватает данных профиля. Пройди настройку ещё раз.',
  errIncompleteDemographics: 'Сначала укажи пол и возраст в общем профиле (/start).',
  errPersistFailed: 'Не удалось сохранить профиль. Попробуй позже.',

  genderMen: 'мужской',
  genderWomen: 'женский',
  empty: '—',

  cbToastMaxLen: 200,
  cbToastTruncateSuffix: '...',
} as const;
