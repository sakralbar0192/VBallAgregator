import { Context } from 'telegraf';
import { registerUser, updateUserLevel, registerOrganizer } from '../../application/use-cases.js';
import { prisma } from '../../infrastructure/prisma.js';

export class RegistrationHandler {
  async handleStart(ctx: Context): Promise<void> {
    const telegramId = ctx.from!.id;
    const name = ctx.from!.first_name + (ctx.from!.last_name ? ' ' + ctx.from!.last_name : '');

    await registerUser(telegramId, name);

    await ctx.reply('Привет! Я бот для организации волейбольных игр. Выбери свою роль:', {
      reply_markup: {
        inline_keyboard: [
          [{ text: 'Игрок', callback_data: 'role_player' }],
          [{ text: 'Организатор', callback_data: 'role_organizer' }]
        ]
      }
    });
  }

  async handleRolePlayer(ctx: Context): Promise<void> {
    await ctx.editMessageText('Ты выбрал роль игрока. Теперь оцени свой уровень:', {
      reply_markup: {
        inline_keyboard: [
          [{ text: 'Новичок', callback_data: 'level_novice' }],
          [{ text: 'Любитель', callback_data: 'level_amateur' }],
          [{ text: 'Опытный', callback_data: 'level_experienced' }],
          [{ text: 'Профи', callback_data: 'level_pro' }]
        ]
      }
    });
  }

  async handleLevelSelection(ctx: Context, level: string): Promise<void> {
    const telegramId = ctx.from!.id;

    const user = await prisma.user.findUnique({ where: { telegramId } });
    if (!user || !user.id) {
      return ctx.editMessageText('Пользователь не найден. Начни с команды /start');
    }

    await updateUserLevel(user.id, level);

    await ctx.editMessageText('Отлично! Теперь ты можешь искать игры командой /games');
  }

  async handleRoleOrganizer(ctx: Context): Promise<void> {
    const telegramId = ctx.from!.id;

    const user = await prisma.user.findUnique({ where: { telegramId } });
    if (!user || !user.id) {
      return ctx.editMessageText('Пользователь не найден. Начни с команды /start');
    }

    await registerOrganizer(user.id, ctx.from!.first_name);

    await ctx.editMessageText('Ты зарегистрирован как организатор! Создай игру командой /newgame');
  }
}