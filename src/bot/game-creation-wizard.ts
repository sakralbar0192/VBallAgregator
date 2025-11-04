import { Context } from 'telegraf';
import { createGame } from '../application/use-cases.js';
import { prisma } from '../infrastructure/prisma.js';
import { formatGameTimeForNotification } from '../shared/date-utils.js';

export class GameCreationWizard {
  private static sessions = new Map<number, Partial<GameCreationSession>>();

  static async start(ctx: Context): Promise<void> {
    const telegramId = ctx.from!.id;

    const user = await prisma.user.findUnique({ where: { telegramId } });
    if (!user) {
      await ctx.reply('Сначала зарегистрируйся командой /start');
      return;
    }

    const organizer = await prisma.organizer.findUnique({ where: { userId: user.id } });
    if (!organizer) {
      await ctx.reply('Ты не зарегистрирован как организатор. Выбери роль организатора в /start');
      return;
    }

    // Начинаем сессию
    this.sessions.set(telegramId, { userId: user.id });

    // Проверяем, можно ли создать игру сегодня (не менее чем за 4 часа)
    const now = new Date();
    const minStartTime = new Date(now.getTime() + 4 * 60 * 60 * 1000);
    const todayMinHour = minStartTime.getHours();
    const showToday = todayMinHour <= 21;

    const dateButtons = [];
    if (showToday) {
      dateButtons.push([{ text: 'Сегодня', callback_data: 'wizard_date_today' }]);
    }
    dateButtons.push(
      [{ text: 'Завтра', callback_data: 'wizard_date_tomorrow' }],
      [{ text: 'Послезавтра', callback_data: 'wizard_date_day_after' }]
    );

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

    // Вычисляем дату
    const selectedDate = this.calculateDate(dateKey);
    session.date = selectedDate;

    // Шаг 2: выбор времени
    const now = new Date();
    const minStartTime = new Date(now.getTime() + 4 * 60 * 60 * 1000);
    const isToday = selectedDate.toDateString() === now.toDateString();

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
    await ctx.editMessageText(`📅 ${session.date.toLocaleDateString('ru-RU')} в ${session.date.getHours().toString().padStart(2, '0')}:00\n🎯 Уровень: ${session.levelTag}\n\n🏟️ Выбери площадку:`, {
      reply_markup: {
        inline_keyboard: [
          [{ text: '"Чайка"', callback_data: `wizard_venue_chaika` }],
          [{ text: '"ФОК"', callback_data: `wizard_venue_fok` }],
          [{ text: '5-ая школа', callback_data: `wizard_venue_5th_school` }]
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
    await ctx.editMessageText(`📅 ${session.date.toLocaleDateString('ru-RU')} в ${session.date.getHours().toString().padStart(2, '0')}:00\n🎯 Уровень: ${session.levelTag}\n🏟️ ${venueKey === 'chaika' ? '"Чайка"' : venueKey === 'fok' ? '"ФОК"' : '5-ая школа'}\n\n👥 Выбери вместимость игры:`, {
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
    await ctx.editMessageText(`📅 ${session.date.toLocaleDateString('ru-RU')} в ${session.date.getHours().toString().padStart(2, '0')}:00\n🎯 Уровень: ${session.levelTag}\n🏟️ ${(session as any).venueKey === 'chaika' ? '"Чайка"' : (session as any).venueKey === 'fok' ? '"ФОК"' : '5-ая школа'}\n👥 Вместимость: ${capacity} игроков\n\n💰 Выбери стоимость игры:`, {
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

    // Map venue keys to IDs
    const venueMap: Record<string, string> = {
      chaika: 'venue-chaika-id',
      fok: 'venue-fok-id',
      "5th_school": 'venue-5th-school-id'
    };

    const venueKey = (session as any).venueKey;
    const venueId = venueMap[venueKey];
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

      const venueName = venueKey === 'chaika' ? '"Чайка"' :
                        venueKey === 'fok' ? '"ФОК"' : '5-ая школа';

      await ctx.editMessageText(
        `✅ Игра создана!\n\n📅 ${formatGameTimeForNotification(session.date)}\n🎯 Уровень: ${session.levelTag}\n🏟️ ${venueName}\n👥 Вместимость: ${session.capacity} игроков\n💰 ${priceText}\n\nID игры: \`${game.id}\`\n\nРасскажи друзьям: \`/join ${game.id}\``,
        { parse_mode: 'Markdown' }
      );
    } catch (error: any) {
      await ctx.editMessageText(`❌ Ошибка создания игры: ${error.message}`);
    }
  }

  private static calculateDate(dateKey: string): Date {
    const baseDate = new Date();
    let selectedDate: Date;

    switch (dateKey) {
      case 'today':
        selectedDate = new Date(baseDate);
        break;
      case 'tomorrow':
        selectedDate = new Date(baseDate);
        selectedDate.setDate(selectedDate.getDate() + 1);
        break;
      case 'day_after':
        selectedDate = new Date(baseDate);
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