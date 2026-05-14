import { Telegraf, Context } from 'telegraf';
import { IBotModule } from './bot-module-registry.js';
import { GameManagementHandler } from '../game-management/index.js';
import { CommandValidator } from '../common/index.js';
import { GameCreationWizard } from '../game-creation-wizard.js';

/**
 * Модуль управления играми
 */
export class GameManagementModule implements IBotModule {
  name = 'GameManagementModule';

  async register(bot: Telegraf<Context>): Promise<void> {
    // Команды управления играми
    bot.command('games', GameManagementHandler.handleGames);

    bot.command('game', async (ctx) => {
      const gameId = await CommandValidator.validateAndExtractGameId(ctx, 'game');
      await GameManagementHandler.handleGameInfo(ctx, gameId);
    });

    bot.command('join', async (ctx) => {
      const gameId = await CommandValidator.validateAndExtractGameId(ctx, 'join');
      await GameManagementHandler.handleJoin(ctx, gameId);
    });

    bot.command('close', async (ctx) => {
      const gameId = await CommandValidator.validateAndExtractGameId(ctx, 'close');
      await GameManagementHandler.handleClose(ctx, gameId);
    });

    bot.command('leave', async (ctx) => {
      const gameId = await CommandValidator.validateAndExtractGameId(ctx, 'leave');
      await GameManagementHandler.handleLeave(ctx, gameId);
    });

    // Обработчики callback'ов для управления играми
    bot.action(/^join_game_(.+)$/, async (ctx) => {
      await GameManagementHandler.handleGameAction(ctx, ctx.match[0] ?? '');
    });

    bot.action(/^leave_game_(.+)$/, async (ctx) => {
      await GameManagementHandler.handleGameAction(ctx, ctx.match[0] ?? '');
    });

    bot.action(/^pay_game_(.+)$/, async (ctx) => {
      await GameManagementHandler.handleGameAction(ctx, ctx.match[0] ?? '');
    });

    bot.action(/^close_game_(.+)$/, async (ctx) => {
      await GameManagementHandler.handleGameAction(ctx, ctx.match[0] ?? '');
    });

    bot.action(/^payments_game_(.+)$/, async (ctx) => {
      await GameManagementHandler.handleGameAction(ctx, ctx.match[0] ?? '');
    });

    // Мастер создания игры
    bot.command('newgame', async (ctx: any) => {
      await GameCreationWizard.start(ctx);
    });

    bot.action(/^wizard_date_(.+)$/, async (ctx: any) => {
      const dateKey = ctx.match[1];
      await GameCreationWizard.handleDateSelection(ctx, dateKey);
    });

    bot.action(/^wizard_time_(\d+)$/, async (ctx: any) => {
      const hour = parseInt(ctx.match[1]);
      await GameCreationWizard.handleTimeSelection(ctx, hour);
    });

    bot.action(/^wizard_level_(.+)$/, async (ctx: any) => {
      const level = ctx.match[1];
      await GameCreationWizard.handleLevelSelection(ctx, level);
    });

    bot.action(/^wizard_venue_(.+)$/, async (ctx: any) => {
      const venueKey = ctx.match[1];
      await GameCreationWizard.handleVenueSelection(ctx, venueKey);
    });

    bot.action(/^wizard_capacity_(\d+)$/, async (ctx: any) => {
      const capacity = parseInt(ctx.match[1]);
      await GameCreationWizard.handleCapacitySelection(ctx, capacity);
    });

    bot.action(/^wizard_price_(.+)$/, async (ctx: any) => {
      const price = ctx.match[1];
      await GameCreationWizard.handlePriceSelection(ctx, price);
    });
  }
}
