import type { CatalogSport } from './onboarding-constants.js';

export const OnbText = {
  startNewUser:
    'Привет! Я помогаю находить спортивные игры и события. Выбери один или несколько видов спорта.',
  startAllSportsConfigured: 'Профили по всем доступным видам спорта уже есть. Что изменить?',
  startPartialConfigured: (completed: string, missing: string) =>
    `У тебя настроены: ${completed}. Можно изменить профиль или добавить вид спорта: ${missing}.`,

  sportVolleyball: '🏐 Волейбол',
  sportTennis: '🎾 Большой теннис',
  sportDone: '✅ Далее',
  editVolleyball: 'Изменить волейбол',
  editTennis: 'Изменить теннис',
  partialEditProfile: 'Редактировать профиль',
  partialAddSport: 'Добавить вид спорта',
  partialPickSport: 'Выбери новые виды спорта:',
  partialWhichProfile: 'Какой профиль изменить?',
  sportLabelVolleyball: 'Волейбол',
  sportLabelTennis: 'Теннис',

  errPickMissingSport: 'Выбери хотя бы один из недостающих видов спорта.',
  errSessionStale: 'Сессия устарела. Нажми /start.',

  demoGenderTitle: 'Демография (один раз). Выбери пол:',
  demoGenderMen: 'Мужской',
  demoGenderWomen: 'Женский',
  demoAgeTitle: 'Демография (один раз). Выбери возрастной диапазон:',
  demoAgeBefore20: 'до 20',
  demoAge2030: '20–30',
  demoAge30Plus: '30+',

  tennisSetup: 'Настройка большого тенниса — ответь на вопросы в этом сообщении.',
  vbFormatsNew: 'Волейбол: выбери форматы (можно оба).',
  vbFormatsEdit: 'Редактирование волейбола: форматы.',
  vbLevel: 'Уровень игры (волейбол):',
  vbWeekDays: 'Подходящие дни недели:',
  vbTimeForDay: (dayName: string) => `⏰ ${dayName} — выбери время (можно несколько):`,
  vbOrganize: 'Планируешь ли сам(а) организовывать волейбольные игры?',
  vbYes: 'Да',
  vbNo: 'Нет',
  back: '◀️ Назад',
  done: 'Готово',
  doneForDay: 'Готово для этого дня',

  errPickFormat: 'Выбери хотя бы один формат.',
  errPickWeekDay: 'Выбери хотя бы один день.',
  errPickTimeForDay: 'Выбери хотя бы одно время для этого дня.',
  errVbWizardAtFirst: 'Это первый шаг волейбола — назад некуда.',

  vbSummaryTitle: '✅ Профиль волейбола настроен!\n\n',
  vbSummaryFormats: (formats: string) => `Форматы: ${formats}\n`,
  vbSummaryLevel: (level: string) => `Уровень: ${level}\n`,
  vbSummaryDays: (days: string) => `Дни: ${days}\n`,
  vbSummaryTimes: (times: string) => `Время: ${times}\n`,
  vbSummaryOrganize: (value: string) => `Организовать игры: ${value}\n`,
  summaryEmpty: '—',
  organizeYes: 'да',
  organizeNo: 'нет',

  discoveryHeader: 'Готово. Как искать игры и события:',
  discoveryVolleyball: '🏐 Волейбол — список игр и запись: /games.',
  discoveryTennis: '🎾 Большой теннис — поиск по профилю в боте пока в разработке.',
  registrationDone: 'Регистрация завершена.',
  queueNextSport: (sport: CatalogSport) =>
    `Далее — настройка: ${sport === 'tennis' ? 'большой теннис' : 'волейбол'}.`,

  defaultOrganizerName: 'Организатор',
  checkedPrefix: '✅ ',
  checkedPrefixShort: '✅',
} as const;
