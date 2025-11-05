import { Context } from 'telegraf';
import { createGame } from '../application/use-cases.js';
import { prisma } from '../infrastructure/prisma.js';
import { formatGameTimeForNotification, getUserTimezone, getMinGameStartTime, isTodayInTimezone, getCurrentTimeInTimezone } from '../shared/date-utils.js';
import { getVenueName, VENUE_IDS } from '../shared/game-constants.js';

export class GameCreationWizard {
  private static sessions = new Map<number, Partial<GameCreationSession>>();

  /**
   * Инициирует процесс создания игры
   * 1. Проверяет, что пользователь зарегистрирован и является организатором
   * 2. Определяет, доступна ли опция "Сегодня" (если минимальное время начала <= 21:00)
   * 3. Показывает кнопки выбора даты
   */
  static async start(ctx: Context): Promise<void> {
    const telegramId = ctx.from!.id;

    // Получаем пользователя по Telegram ID
    const user = await prisma.user.findUnique({ where: { telegramId } });
    if (!user) {
      await ctx.reply('Сначала зарегистрируйся командой /start');
      return;
    }

    // Проверяем, что пользователь зарегистрирован как организатор
    const organizer = await prisma.organizer.findUnique({ where: { userId: user.id } });
    if (!organizer) {
      await ctx.reply('Ты не зарегистрирован как организатор. Выбери роль организатора в /start');
      return;
    }

    // Инициализируем сессию создания игры
    this.sessions.set(telegramId, { userId: user.id });

    // Определяем, можно ли создать игру сегодня
    // Правило: игру можно создать только если минимальное время начала (текущее время + 4 часа) <= 21:00
    // Это гарантирует, что есть хотя бы один доступный слот времени (21:00 - максимальное время)
    const userTz = getUserTimezone(user.id);
    const minStartTime = getMinGameStartTime(userTz);
    const todayMinHour = minStartTime.getHours();
    // showToday = true только если минимальное время начала в пределах дня (часы < 24)
    // т.е. если текущее время + 4 часа не переходит на следующий день
    const nowInUserTz = getCurrentTimeInTimezone(userTz);
    const isSameDay = minStartTime.toDateString() === nowInUserTz.toDateString();
    const showToday = isSameDay && todayMinHour <= 21;

    // Формируем кнопки выбора даты
    const dateButtons = [];
    if (showToday) {
      dateButtons.push([{ text: 'Сегодня', callback_data: 'wizard_date_today' }]);
    }
    dateButtons.push(
      [{ text: 'Завтра', callback_data: 'wizard_date_tomorrow' }],
      [{ text: 'Послезавтра', callback_data: 'wizard_date_day_after' }]
    );

    // Отправляем сообщение с выбором даты
    await ctx.reply('🗓️ Выбери дату игры:', {
      reply_markup: {
        inline_keyboard: dateButtons
      }
    });
  }

  static async handleDateSelection(ctx: Context, dateKey: string): Promise<void> {
    const telegramId = ctx.from!.id;
    const session = this.sessions.get(telegramId);
    if (!session) {
      await ctx.editMessageText('Сессия истекла. Начни заново с /newgame');
      return;
    }

    // Вычисляем дату в пользовательском TZ
    const userTz = getUserTimezone(session.userId!);
    const selectedDate = this.calculateDate(dateKey, userTz);
    session.date = selectedDate;

    // Шаг 2: выбор времени
    const minStartTime = getMinGameStartTime(userTz);
    const isToday = isTodayInTimezone(selectedDate, userTz);

    let startHour = 9;
    if (isToday) {
      startHour = Math.max(9, minStartTime.getHours());
    }

    const timeButtons = [];
    for (let hour = startHour; hour <= 21; hour += 1) {
      const timeStr = `${hour.toString().padStart(2, '0')}:00`;
      timeButtons.push([{ text: timeStr, callback_data: `wizard_time_${hour}` }]);
    }

    await ctx.editMessageText(`📅 Дата: ${selectedDate.toLocaleDateString('ru-RU')}\n\n⏰ Выбери время начала:`, {
      reply_markup: {
        inline_keyboard: timeButtons
      }
    });
  }

  static async handleTimeSelection(ctx: Context, hour: number): Promise<void> {
    const telegramId = ctx.from!.id;
    const session = this.sessions.get(telegramId);
    if (!session || !session.date) {
      await ctx.editMessageText('Сессия истекла. Начни заново с /newgame');
      return;
    }

    // Устанавливаем время
    session.date.setHours(hour, 0, 0, 0);

    // Шаг 3: выбор уровня игры
    await ctx.editMessageText(`📅 ${session.date.toLocaleDateString('ru-RU')} в ${hour.toString().padStart(2, '0')}:00\n\n🎯 Выбери уровень игры:`, {
      reply_markup: {
        inline_keyboard: [
          [{ text: 'Новички', callback_data: `wizard_level_novice` }],
          [{ text: 'Любители', callback_data: `wizard_level_amateur` }],
          [{ text: 'Опытные', callback_data: `wizard_level_experienced` }],
          [{ text: 'Профи', callback_data: `wizard_level_pro` }]
        ]
      }
    });
  }

  static async handleLevelSelection(ctx: Context, level: string): Promise<void> {
    const telegramId = ctx.from!.id;
    const session = this.sessions.get(telegramId);
    if (!session || !session.date) {
      await ctx.editMessageText('Сессия истекла. Начни заново с /newgame');
      return;
    }

    // Map level identifiers to readable names
    const levelNames: Record<string, string> = {
      novice: 'Новички',
      amateur: 'Любители',
      experienced: 'Опытные',
      pro: 'Профи'
    };

    session.levelTag = levelNames[level] || level;

    // Шаг 4: выбор площадки
    await ctx.editMessageText(`📅 ${
      session.date.toLocaleDateString('ru-RU')
      } в ${
        session.date.getHours().toString().padStart(2, '0')
      }:00\n🎯 Уровень: ${
        session.levelTag
      }\n\n🏟️ Выбери площадку:`, {
      reply_markup: {
        inline_keyboard: [
          [{ text: '"Чайка"', callback_data: `wizard_venue_${VENUE_IDS.CHAIKA}` }],
          [{ text: '"ФОК"', callback_data: `wizard_venue_${VENUE_IDS.FOK}` }],
          [{ text: '5-ая школа', callback_data: `wizard_venue_${VENUE_IDS.FIFTH_SCHOOL}` }]
        ]
      }
    });
  }

  static async handleVenueSelection(ctx: Context, venueKey: string): Promise<void> {
    const telegramId = ctx.from!.id;
    const session = this.sessions.get(telegramId);
    if (!session || !session.date || !session.levelTag || !session.userId) {
      await ctx.editMessageText('Сессия истекла. Начни заново с /newgame');
      return;
    }

    // Сохраняем venueKey в сессии
    (session as any).venueKey = venueKey;

    // Шаг 5: выбор вместимости (с default значением)
    await ctx.editMessageText(`📅 ${
      session.date.toLocaleDateString('ru-RU')
      } в ${
        session.date.getHours().toString().padStart(2, '0')
      }:00\n🎯 Уровень: ${
        session.levelTag
      }\n🏟️ ${
        getVenueName(venueKey) || ''
      }\n\n👥 Выбери вместимость игры:`, {
      reply_markup: {
        inline_keyboard: [
          [{ text: '8 игроков', callback_data: `wizard_capacity_8` }],
          [{ text: '12 игроков (по умолчанию)', callback_data: `wizard_capacity_12` }],
          [{ text: '14 игроков', callback_data: `wizard_capacity_14` }]
        ]
      }
    });
  }

  static async handleCapacitySelection(ctx: Context, capacity: number): Promise<void> {
    const telegramId = ctx.from!.id;
    const session = this.sessions.get(telegramId);
    if (!session || !session.date || !session.levelTag || !session.userId) {
      await ctx.editMessageText('Сессия истекла. Начни заново с /newgame');
      return;
    }

    session.capacity = capacity;

    // Шаг 6: выбор цены
    await ctx.editMessageText(`📅 ${
      session.date.toLocaleDateString('ru-RU')
      } в ${
        session.date.getHours().toString().padStart(2, '0')
      }:00\n🎯 Уровень: ${
        session.levelTag
      }\n🏟️ ${
        getVenueName((session as any).venueKey) || ''
      }\n👥 Вместимость: ${
        capacity
      } игроков\n\n💰 Выбери стоимость игры:`, {
      reply_markup: {
        inline_keyboard: [
          [{ text: '125₽', callback_data: `wizard_price_125` }],
          [{ text: '150₽', callback_data: `wizard_price_150` }],
          [{ text: '200₽', callback_data: `wizard_price_200` }],
          [{ text: 'Другое', callback_data: `wizard_price_other` }]
        ]
      }
    });
  }

  static async handlePriceSelection(ctx: Context, price: string): Promise<void> {
    const telegramId = ctx.from!.id;
    const session = this.sessions.get(telegramId);
    if (!session || !session.date || !session.levelTag || !session.userId || !session.capacity) {
      await ctx.editMessageText('Сессия истекла. Начни заново с /newgame');
      return;
    }

    // Валидация: проверяем, что время игры не в прошлом
    const userTz = getUserTimezone(session.userId);
    const nowInUserTz = getCurrentTimeInTimezone(userTz);
    const gameTimeInUserTz = new Date(session.date.toLocaleString('en-US', { timeZone: userTz }));

    if (gameTimeInUserTz <= nowInUserTz) {
      await ctx.editMessageText('❌ Ошибка: время игры не может быть в прошлом. Начни заново с /newgame');
      this.sessions.delete(telegramId);
      return;
    }

    const venueId = (session as any).venueKey;
    if (!venueId) {
      await ctx.editMessageText('Площадка не найдена');
      return;
    }

    const priceText = price === 'other' ? 'По согласованию с организатором' : `${price}₽`;

    try {
      const game = await createGame({
        organizerId: session.userId,
        venueId,
        startsAt: session.date,
        capacity: session.capacity,
        levelTag: session.levelTag,
        priceText
      });

      // Очищаем сессию
      this.sessions.delete(telegramId);

      await ctx.editMessageText(
        `✅ Игра создана!\n\n📅 ${
          formatGameTimeForNotification(session.date)
        }\n🎯 Уровень: ${
          session.levelTag
        }\n🏟️ ${
          getVenueName(venueId) || ''
        }\n👥 Вместимость: ${
          session.capacity
        } игроков\n💰 ${
          priceText
        }\n\nID игры: \`${
          game.id
        }\`\n\nРасскажи друзьям: \`/join ${
          game.id
        }\``,
        { parse_mode: 'Markdown' }
      );
    } catch (error: any) {
      await ctx.editMessageText(`❌ Ошибка создания игры: ${error.message}`);
    }
  }

  private static calculateDate(dateKey: string, timezone: string = 'Asia/Irkutsk'): Date {
    // Получаем текущую дату в пользовательском TZ
    const nowInUserTz = getCurrentTimeInTimezone(timezone);
    let selectedDate: Date;

    switch (dateKey) {
      case 'today':
        selectedDate = new Date(nowInUserTz);
        break;
      case 'tomorrow':
        selectedDate = new Date(nowInUserTz);
        selectedDate.setDate(selectedDate.getDate() + 1);
        break;
      case 'day_after':
        selectedDate = new Date(nowInUserTz);
        selectedDate.setDate(selectedDate.getDate() + 2);
        break;
      default:
        throw new Error('Неверная дата');
    }

    return selectedDate;
  }

  static clearSession(telegramId: number): void {
    this.sessions.delete(telegramId);
  }
}

interface GameCreationSession {
  userId: string;
  date?: Date;
  levelTag?: string;
  venueKey?: string;
  capacity?: number;
}