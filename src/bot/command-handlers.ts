import { Context } from 'telegraf';
import { z } from 'zod';
import { joinGame, leaveGame, markPayment, listGames, closeGame } from '../application/use-cases.js';
import { prisma } from '../infrastructure/prisma.js';
import { formatGameTimeForNotification } from '../shared/date-utils.js';
import { ErrorHandler } from '../shared/error-handler.js';

const GameIdSchema = z.string().uuid();

export class CommandHandlers {
  static async handleGames(ctx: Context): Promise<void> {
    const games = await listGames();

    if (games.length === 0) {
      await ctx.reply('Нет активных игр. Создай новую командой /newgame');
      return;
    }

    const gamesList = games.map((game: any) => {
      const date = formatGameTimeForNotification(game.startsAt);
      const status = game.status === 'open' ? '🟢 Открыта' : game.status === 'closed' ? '🔴 Закрыта' : '✅ Завершена';
      const level = game.levelTag ? ` (${game.levelTag})` : '';
      const price = game.priceText ? ` - ${game.priceText}` : '';
      const capacity = game.capacity;

      return `🎾 ${date}${level}${price}\n${status} (${capacity} мест)\nID: \`${game.id}\``;
    }).join('\n\n');

    await ctx.reply(`Активные игры:\n\n${gamesList}`, { parse_mode: 'Markdown' });
  }

  static async handleJoin(ctx: Context, gameId: string): Promise<void> {
    const user = await prisma.user.findUnique({ where: { telegramId: ctx.from!.id } });
    if (!user) {
      await ctx.reply('Сначала зарегистрируйся командой /start');
      return;
    }

    const validationResult = GameIdSchema.safeParse(gameId);
    if (!validationResult.success) {
      await ctx.reply('Неверный формат ID игры. Используй UUID.');
      return;
    }

    try {
      const result = await joinGame(gameId, user.id!);
      const message = result.status === 'confirmed'
        ? 'Место забронировано ✅'
        : 'Лист ожидания ⏳ (сообщим, если место освободится)';
      await ctx.reply(message);
    } catch (error: any) {
      if (error.code === 'ALREADY_REGISTERED') {
        await ctx.reply('Вы уже зарегистрированы на эту игру');
      } else {
        await ctx.reply(ErrorHandler.mapToUserMessage(error));
      }
    }
  }

  static async handleLeave(ctx: Context, gameId: string): Promise<void> {
    const user = await prisma.user.findUnique({ where: { telegramId: ctx.from!.id } });
    if (!user) {
      await ctx.reply('Сначала зарегистрируйся командой /start');
      return;
    }

    const validationResult = GameIdSchema.safeParse(gameId);
    if (!validationResult.success) {
      await ctx.reply('Неверный формат ID игры. Используй UUID.');
      return;
    }

    try {
      await leaveGame(gameId, user.id!);
      await ctx.reply('Запись отменена. Если освободилось место, пригласили следующего.');
    } catch (error: any) {
      await ctx.reply(ErrorHandler.mapToUserMessage(error));
    }
  }

  static async handlePay(ctx: Context, gameId: string): Promise<void> {
    const user = await prisma.user.findUnique({ where: { telegramId: ctx.from!.id } });
    if (!user) {
      await ctx.reply('Сначала зарегистрируйся командой /start');
      return;
    }

    const validationResult = GameIdSchema.safeParse(gameId);
    if (!validationResult.success) {
      await ctx.reply('Неверный формат ID игры. Используй UUID.');
      return;
    }

    try {
      await markPayment(gameId, user.id!);
      await ctx.reply('Оплата отмечена 💰 Спасибо!');
    } catch (error: any) {
      if (error.code === 'PAYMENT_WINDOW_NOT_OPEN') {
        await ctx.reply('Окно оплаты еще не открыто');
      } else {
        await ctx.reply(ErrorHandler.mapToUserMessage(error));
      }
    }
  }

  static async handleClose(ctx: Context, gameId: string): Promise<void> {
    const user = await prisma.user.findUnique({ where: { telegramId: ctx.from!.id } });
    if (!user) {
      await ctx.reply('Сначала зарегистрируйся командой /start');
      return;
    }

    const organizer = await prisma.organizer.findUnique({ where: { userId: user.id } });
    if (!organizer) {
      await ctx.reply('Ты не зарегистрирован как организатор');
      return;
    }

    const validationResult = GameIdSchema.safeParse(gameId);
    if (!validationResult.success) {
      await ctx.reply('Неверный формат ID игры. Используй UUID.');
      return;
    }

    try {
      await closeGame(gameId);
      await ctx.reply('Игра закрыта для новых записей 🔒');
    } catch (error: any) {
      await ctx.reply(ErrorHandler.mapToUserMessage(error));
    }
  }

  static async handleMy(ctx: Context): Promise<void> {
    const telegramId = ctx.from!.id;

    const user = await prisma.user.findUnique({ where: { telegramId } });
    if (!user) {
      await ctx.reply('Сначала зарегистрируйся командой /start');
      return;
    }

    // Получить все регистрации пользователя
    const { GetUserRegistrationsQuery } = await import('../application/queries/GetUserRegistrationsQuery.js');
    const query = new GetUserRegistrationsQuery(user.id);
    const registrations = await query.execute();

    if (registrations.length === 0) {
      await ctx.reply('У тебя нет активных регистраций. Найди игру командой /games');
      return;
    }

    const gamesList = registrations.map((reg: any) => {
      const game = reg.game;
      const date = formatGameTimeForNotification(game.startsAt);

      const status = reg.status === 'confirmed' ? '✅ Подтвержден' :
                    reg.status === 'waitlisted' ? '⏳ В ожидании' : '❌ Отменен';
      const payment = reg.paymentStatus === 'paid' ? '💰 Оплачено' : '⏳ Не оплачено';
      const level = game.levelTag ? ` (${game.levelTag})` : '';
      const price = game.priceText ? ` - ${game.priceText}` : '';

      return `🎾 ${date}${level}${price}\n${status} | ${payment}\nОрганизатор: ${game.organizer.title}\nID: \`${game.id}\``;
    }).join('\n\n');

    await ctx.reply(`Твои игры:\n\n${gamesList}`, { parse_mode: 'Markdown' });
  }

  static async handlePayments(ctx: Context, gameId: string): Promise<void> {
    const telegramId = ctx.from!.id;

    const user = await prisma.user.findUnique({ where: { telegramId } });
    if (!user) {
      await ctx.reply('Сначала зарегистрируйся командой /start');
      return;
    }

    const organizer = await prisma.organizer.findUnique({ where: { userId: user.id } });
    if (!organizer) {
      await ctx.reply('Ты не зарегистрирован как организатор');
      return;
    }

    const validationResult = GameIdSchema.safeParse(gameId);
    if (!validationResult.success) {
      await ctx.reply('Неверный формат ID игры. Используй UUID.');
      return;
    }

    // Получить игру и все регистрации
    const game = await prisma.game.findUnique({
      where: { id: gameId, organizerId: organizer.id },
      include: {
        registrations: {
          include: { user: true },
          where: { status: 'confirmed' }
        }
      }
    });

    if (!game) {
      await ctx.reply('Игра не найдена или ты не организатор этой игры');
      return;
    }

    const date = formatGameTimeForNotification(game.startsAt);

    const payments = game.registrations.map((reg: any) => {
      const paymentStatus = reg.paymentStatus === 'paid' ? '💰 Оплачено' : '⏳ Не оплачено';
      const paymentDate = reg.paymentMarkedAt ? ` (${reg.paymentMarkedAt.toLocaleDateString('ru-RU')})` : '';
      return `${reg.user.name}: ${paymentStatus}${paymentDate}`;
    }).join('\n');

    const paidCount = game.registrations.filter((r: any) => r.paymentStatus === 'paid').length;
    const totalCount = game.registrations.length;

    await ctx.reply(`💰 Статус оплат для игры ${date}\n\n${payments}\n\nОплачено: ${paidCount}/${totalCount}`, { parse_mode: 'Markdown' });
  }
}