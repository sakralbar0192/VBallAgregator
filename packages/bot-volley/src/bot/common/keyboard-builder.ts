import { InlineKeyboardButton } from 'telegraf/types';

/**
 * Утилиты для создания inline клавиатур
 */
export class KeyboardBuilder {
  /**
   * Создать клавиатуру для действий с игрой
   */
  static createGameActionKeyboard(gameId: string, options: {
    canJoin?: boolean;
    canLeave?: boolean;
    canPay?: boolean;
    canClose?: boolean;
    canViewPayments?: boolean;
  } = {}): InlineKeyboardButton[][] {
    const buttons: InlineKeyboardButton[] = [];

    if (options.canJoin) {
      buttons.push({ text: '📥 Присоединиться', callback_data: `join_game_${gameId}` });
    }

    if (options.canLeave) {
      buttons.push({ text: '📤 Отменить запись', callback_data: `leave_game_${gameId}` });
    }

    if (options.canPay) {
      buttons.push({ text: '💰 Отметить оплату', callback_data: `pay_game_${gameId}` });
    }

    if (options.canViewPayments) {
      buttons.push({ text: '📊 Статус оплат', callback_data: `payments_game_${gameId}` });
    }

    if (options.canClose) {
      buttons.push({ text: '🔒 Закрыть игру', callback_data: `close_game_${gameId}` });
    }

    // Разбиваем на ряды по 2 кнопки
    const rows: InlineKeyboardButton[][] = [];
    for (let i = 0; i < buttons.length; i += 2) {
      rows.push(buttons.slice(i, i + 2));
    }

    return rows;
  }

  /**
   * Создать клавиатуру для настроек
   */
  static createSettingsKeyboard(preferences: {
    globalNotifications?: boolean;
    paymentRemindersAuto?: boolean;
    paymentRemindersManual?: boolean;
    gameReminders24h?: boolean;
    gameReminders2h?: boolean;
    organizerNotifications?: boolean;
  }): InlineKeyboardButton[][] {
    return [
      [
        {
          text: `🌐 Глобальные уведомления: ${preferences.globalNotifications ? '✅' : '❌'}`,
          callback_data: 'toggle_global'
        }
      ],
      [
        { text: '💰 Настройки оплат', callback_data: 'settings_payments' },
        { text: '🎾 Настройки игр', callback_data: 'settings_games' }
      ],
      [
        { text: '👥 Уведомления организатора', callback_data: 'settings_organizer' }
      ],
      [
        { text: '⬅️ Назад', callback_data: 'back_to_main' }
      ]
    ];
  }

  /**
   * Создать клавиатуру для выбора организаторов
   */
  static createOrganizerSelectionKeyboard(organizers: Array<{
    id: string;
    title: string | null;
    user: { name: string };
  }>, selectedIds: Set<string>): InlineKeyboardButton[][] {
    const buttons: InlineKeyboardButton[][] = organizers.map(organizer => [
      {
        text: `${selectedIds.has(organizer.id) ? '✅' : '⬜'} ${organizer.title || organizer.user.name}`,
        callback_data: `toggle_organizer_${organizer.id}`
      }
    ]);

    // Добавляем кнопку "Готово"
    buttons.push([
      { text: '✅ Готово', callback_data: 'organizers_done' }
    ]);

    return buttons;
  }

  /**
   * Создать клавиатуру для выбора уровня игрока
   */
  static createLevelSelectionKeyboard(): InlineKeyboardButton[][] {
    return [
      [{ text: 'Новичок', callback_data: 'level_novice' }],
      [{ text: 'Любитель', callback_data: 'level_amateur' }],
      [{ text: 'Опытный', callback_data: 'level_experienced' }],
      [{ text: 'Профи', callback_data: 'level_pro' }]
    ];
  }

  static createSportSelectionKeyboard(): InlineKeyboardButton[][] {
    return [
      [{ text: '🏐 Волейбол', callback_data: 'sport_volleyball' }],
      [{ text: '🎾 Ракетки (теннис, падел и др.)', callback_data: 'sport_racket' }],
    ];
  }

  /**
   * Создать клавиатуру для выбора роли
   */
  static createRoleSelectionKeyboard(): InlineKeyboardButton[][] {
    return [
      [{ text: 'Игрок', callback_data: 'role_player' }],
      [{ text: 'Организатор', callback_data: 'role_organizer' }]
    ];
  }

  /**
   * Создать клавиатуру для завершения регистрации
   */
  static createRegistrationCompletionKeyboard(hasOrganizers: boolean): InlineKeyboardButton[][] {
    if (hasOrganizers) {
      return [
        [{ text: '🔗 Выбрать организаторов', callback_data: 'select_organizers_registration' }],
        [{ text: '✅ Завершить регистрацию', callback_data: 'finish_registration' }]
      ];
    } else {
      return [
        [{ text: '✅ Завершить регистрацию', callback_data: 'finish_registration' }]
      ];
    }
  }

  /**
   * Создать главную палитру команд
   */
  static createMainCommandPalette(userInfo: {
    isOrganizer: boolean;
    hasPlayerRegistrations: boolean;
  }): InlineKeyboardButton[][] {
    const buttons: InlineKeyboardButton[][] = [];

    // Первый ряд - основные действия
    buttons.push([
      { text: '🎾 Найти игры', callback_data: 'cmd_games' },
      { text: '📋 Мои игры', callback_data: 'cmd_my' }
    ]);

    // Второй ряд - действия по ролям
    if (userInfo.hasPlayerRegistrations) {
      buttons.push([
        { text: '⚙️ Настройки', callback_data: 'cmd_settings' },
        { text: '👥 Мои организаторы', callback_data: 'cmd_myorganizers' }
      ]);
    }

    // Третий ряд - для организаторов
    if (userInfo.isOrganizer) {
      buttons.push([
        { text: '➕ Создать игру', callback_data: 'cmd_newgame' },
        { text: '👑 Мои игроки', callback_data: 'cmd_myplayers' }
      ]);
    }

    // Четвертый ряд - общие действия
    buttons.push([
      { text: '❓ Помощь', callback_data: 'cmd_help' }
    ]);

    return buttons;
  }

  /**
   * Создать компактную палитру для быстрого доступа
   */
  static createQuickCommandPalette(userInfo: {
    isOrganizer: boolean;
    hasPlayerRegistrations: boolean;
  }): InlineKeyboardButton[][] {
    const buttons: InlineKeyboardButton[][] = [];

    // Основные действия в один ряд
    const mainButtons = [
      { text: '🎾 Игры', callback_data: 'cmd_games' },
      { text: '📋 Мои', callback_data: 'cmd_my' }
    ];

    if (userInfo.isOrganizer) {
      mainButtons.push({ text: '➕ Создать', callback_data: 'cmd_newgame' });
    }

    if (userInfo.hasPlayerRegistrations) {
      mainButtons.push({ text: '⚙️ Настройки', callback_data: 'cmd_settings' });
    }

    // Разбиваем на ряды по 2 кнопки
    for (let i = 0; i < mainButtons.length; i += 2) {
      buttons.push(mainButtons.slice(i, i + 2));
    }

    return buttons;
  }

  /**
   * Создать клавиатуру для ответа на приглашение
   */
  static createInvitationResponseKeyboard(gameId: string): InlineKeyboardButton[][] {
    return [
      [
        { text: '✅ Да', callback_data: `respond_game_${gameId}_yes` },
        { text: '❌ Нет', callback_data: `respond_game_${gameId}_no` }
      ]
    ];
  }

  /**
   * Создать клавиатуру для управления игроками (для организаторов)
   */
  static createPlayerManagementKeyboard(playerId: string): InlineKeyboardButton[][] {
    return [
      [
        { text: '✅ Подтвердить', callback_data: `confirm_player_${playerId}` },
        { text: '❌ Отклонить', callback_data: `reject_player_${playerId}` }
      ]
    ];
  }

  /**
   * Создать клавиатуру для напоминаний об оплате
   */
  static createPaymentReminderKeyboard(gameId: string): InlineKeyboardButton[][] {
    return [
      [
        { text: '📢 Отправить напоминания', callback_data: `remind_payments_${gameId}` }
      ]
    ];
  }
}