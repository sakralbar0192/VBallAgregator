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

    await ctx.reply('🗓️ Выбери дату игры:', {
      reply_markup: {
        inline_keyboard: [
          [{ text: 'Сегодня', callback_data: 'wizard_date_today' }],
          [{ text: 'Завтра', callback_data: 'wizard_date_tomorrow' }],
          [{ text: 'Послезавтра', callback_data: 'wizard_date_day_after' }]
        ]
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
    const timeButtons = [];
    for (let hour = 9; hour <= 21; hour += 2) {
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

    session.levelTag = level;

    // Шаг 4: выбор площадки
    await ctx.editMessageText(`📅 ${session.date.toLocaleDateString('ru-RU')} в ${session.date.getHours().toString().padStart(2, '0')}:00\n🎯 Уровень: ${level}\n\n🏟️ Выбери площадку:`, {
      reply_markup: {
        inline_keyboard: [
          [{ text: 'Стадион "Волна"', callback_data: `wizard_venue_volna` }],
          [{ text: 'СК "Олимп"', callback_data: `wizard_venue_olimp` }],
          [{ text: 'Парк "Южный"', callback_data: `wizard_venue_south` }]
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

    // Map venue keys to IDs
    const venueMap: Record<string, string> = {
      volna: 'venue-volna-id',
      olimp: 'venue-olimp-id',
      south: 'venue-south-id'
    };

    const venueId = venueMap[venueKey];
    if (!venueId) {
      await ctx.editMessageText('Площадка не найдена');
      return;
    }

    try {
      const game = await createGame({
        organizerId: session.userId,
        venueId,
        startsAt: session.date,
        capacity: 12,
        levelTag: session.levelTag,
        priceText: '500₽'
      });

      // Очищаем сессию
      this.sessions.delete(telegramId);

      const venueName = venueKey === 'volna' ? 'Стадион "Волна"' :
                       venueKey === 'olimp' ? 'СК "Олимп"' : 'Парк "Южный"';

      await ctx.editMessageText(
        `✅ Игра создана!\n\n📅 ${formatGameTimeForNotification(session.date)}\n🎯 Уровень: ${session.levelTag}\n🏟️ ${venueName}\n💰 500₽\n\nID игры: \`${game.id}\`\n\nРасскажи друзьям: \`/join ${game.id}\``,
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
}