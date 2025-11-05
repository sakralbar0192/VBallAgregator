/**
 * Утилиты для парсинга callback данных из inline клавиатур
 */
export class CallbackDataParser {
  /**
   * Извлечь gameId из callback данных типа "join_game_<gameId>"
   */
  static parseGameId(data: string): string | null {
    const match = data.match(/^join_game_(.+)$/);
    return match ? match[1] ?? null : null;
  }

  /**
   * Извлечь playerId из callback данных типа "confirm_player_<playerId>"
   */
  static parsePlayerId(data: string): string | null {
    const match = data.match(/^confirm_player_(.+)$/);
    return match ? match[1] ?? null : null;
  }

  /**
   * Извлечь organizerId из callback данных типа "toggle_organizer_<organizerId>"
   */
  static parseOrganizerId(data: string): string | null {
    const match = data.match(/^toggle_organizer_(.+)$/);
    return match ? match[1] ?? null : null;
  }

  /**
   * Извлечь уровень из callback данных типа "level_<level>"
   */
  static parseLevel(data: string): string | null {
    const match = data.match(/^level_(.+)$/);
    return match ? match[1] ?? null : null;
  }

  /**
   * Извлечь дату из callback данных типа "wizard_date_<dateKey>"
   */
  static parseWizardDate(data: string): string | null {
    const match = data.match(/^wizard_date_(.+)$/);
    return match ? match[1] ?? null : null;
  }

  /**
   * Извлечь время из callback данных типа "wizard_time_<hour>"
   */
  static parseWizardTime(data: string): number | null {
    const match = data.match(/^wizard_time_(\d+)$/);
    return match ? parseInt(match[1] ?? '0') : null;
  }

  /**
   * Извлечь уровень игры из callback данных типа "wizard_level_<level>"
   */
  static parseWizardLevel(data: string): string | null {
    const match = data.match(/^wizard_level_(.+)$/);
    return match ? match[1] ?? null : null;
  }

  /**
   * Извлечь venueKey из callback данных типа "wizard_venue_<venueKey>"
   */
  static parseWizardVenue(data: string): string | null {
    const match = data.match(/^wizard_venue_(.+)$/);
    return match ? match[1] ?? null : null;
  }

  /**
   * Извлечь capacity из callback данных типа "wizard_capacity_<capacity>"
   */
  static parseWizardCapacity(data: string): number | null {
    const match = data.match(/^wizard_capacity_(\d+)$/);
    return match ? parseInt(match[1] ?? '0') : null;
  }

  /**
   * Извлечь price из callback данных типа "wizard_price_<price>"
   */
  static parseWizardPrice(data: string): string | null {
    const match = data.match(/^wizard_price_(.+)$/);
    return match ? match[1] ?? null : null;
  }

  /**
   * Извлечь gameId из callback данных типа "remind_payments_<gameId>"
   */
  static parseRemindPaymentsGameId(data: string): string | null {
    const match = data.match(/^remind_payments_(.+)$/);
    return match ? match[1] ?? null : null;
  }

  /**
   * Извлечь gameId из callback данных типа "close_game_<gameId>"
   */
  static parseCloseGameId(data: string): string | null {
    const match = data.match(/^close_game_(.+)$/);
    return match ? match[1] ?? null : null;
  }

  /**
   * Извлечь gameId из callback данных типа "leave_game_<gameId>"
   */
  static parseLeaveGameId(data: string): string | null {
    const match = data.match(/^leave_game_(.+)$/);
    return match ? match[1] ?? null : null;
  }

  /**
   * Извлечь gameId из callback данных типа "pay_game_<gameId>"
   */
  static parsePayGameId(data: string): string | null {
    const match = data.match(/^pay_game_(.+)$/);
    return match ? match[1] ?? null : null;
  }

  /**
   * Извлечь gameId из callback данных типа "payments_game_<gameId>"
   */
  static parsePaymentsGameId(data: string): string | null {
    const match = data.match(/^payments_game_(.+)$/);
    return match ? match[1] ?? null : null;
  }

  /**
   * Извлечь gameId и response из callback данных типа "respond_game_<gameId>_yes" или "respond_game_<gameId>_no"
   */
  static parseRespondGame(data: string): { gameId: string; response: 'yes' | 'no' } | null {
    const match = data.match(/^respond_game_(.+)_(yes|no)$/);
    if (!match) return null;

    return {
      gameId: match[1] ?? '',
      response: match[2] as 'yes' | 'no'
    };
  }
}