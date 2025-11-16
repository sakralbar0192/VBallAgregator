import { Telegraf } from 'telegraf';
import rateLimit from 'telegraf-ratelimit';
// Импорт модулей
import { RegistrationHandler, LevelSelectionHandler} from './registration/index.js';
import { GameManagementHandler } from './game-management/index.js';
import { PaymentHandler, PaymentReminderHandler } from './payments/index.js';
import { ProfileHandler, PlayerManagementHandler } from './profile/index.js';
import { SettingsHandler, OrganizerSelectionHandler } from './settings/index.js';
import { InvitationHandler } from './invitations/index.js';
import { CommonHandlers, CallbackDataParser, CommandValidator } from './common/index.js';
// Импорт мастера создания игры
import { GameCreationWizard } from './game-creation-wizard.js';

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN!);

const limitConfig = {
  in: 2,        // 2 сообщения
  out: 1,       // за 1 секунду
  unique: true  // per user
};

bot.use(rateLimit(limitConfig));

// Регистрация обработчиков команд

// Команды регистрации
bot.start(RegistrationHandler.handleStart);

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

// Команды платежей
bot.command('pay', async (ctx) => {
  const gameId = await CommandValidator.validateAndExtractGameId(ctx, 'pay');
  await PaymentHandler.handlePay(ctx, gameId);
});

bot.command('payments', async (ctx) => {
  const gameId = await CommandValidator.validateAndExtractGameId(ctx, 'payments');
  await PaymentHandler.handlePayments(ctx, gameId);
});

// Команды профиля
bot.command('my', ProfileHandler.handleMy);
bot.command('myorganizers', ProfileHandler.handleMyOrganizers);
bot.command('myplayers', PlayerManagementHandler.handleMyPlayers);
bot.command('pendingplayers', PlayerManagementHandler.handlePendingPlayers);

// Команды настроек
bot.command('selectorganizers', SettingsHandler.handleSelectOrganizers);

// Команды приглашений
bot.command('respondtogame', async (ctx) => {
  const args = CommandValidator.validateMultiArgCommand(ctx);
  await InvitationHandler.handleRespondToGame(ctx, args);
});

// Команда помощи
bot.command('help', CommonHandlers.handleHelp);

// Мастер создания игры
bot.command('newgame', async (ctx: any) => {
  await GameCreationWizard.start(ctx);
});

// Обработчики callback'ов

// Регистрация
bot.action('role_player', LevelSelectionHandler.handleRolePlayer);
bot.action('role_organizer', RegistrationHandler.handleRoleOrganizer);
bot.action(/^level_(.+)$/, async (ctx) => {
  const level = CallbackDataParser.parseLevel(ctx.match[0]!);
  if (level) {
    await LevelSelectionHandler.handleLevelSelection(ctx, level);
  }
});
bot.action('select_organizers_registration', OrganizerSelectionHandler.handleSelectOrganizersRegistration);
bot.action('finish_registration', LevelSelectionHandler.handleFinishRegistration);

// Управление играми
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

// Платежи
bot.action(/^remind_payments_(.+)$/, async (ctx) => {
  await PaymentReminderHandler.handleRemindPaymentsCallback(ctx, ctx.match[0]);
});

// Профиль (управление игроками)
bot.action(/^confirm_player_(.+)$/, async (ctx) => {
  await PlayerManagementHandler.handleConfirmPlayer(ctx, ctx.match[0]);
});
bot.action(/^reject_player_(.+)$/, async (ctx) => {
  await PlayerManagementHandler.handleRejectPlayer(ctx, ctx.match[0]);
});

// Настройки (в разработке)
bot.action('toggle_global', SettingsHandler.handleToggleGlobal);
bot.action('settings_payments', SettingsHandler.handleSettingsPayments);
bot.action('settings_games', SettingsHandler.handleSettingsGames);
bot.action('settings_organizer', SettingsHandler.handleSettingsOrganizer);
bot.action('back_to_settings', SettingsHandler.handleBackToSettings);
bot.action('toggle_payment_auto', SettingsHandler.handleTogglePaymentAuto);
bot.action('toggle_payment_manual', SettingsHandler.handleTogglePaymentManual);
bot.action('toggle_game_24h', SettingsHandler.handleToggleGame24h);
bot.action('toggle_game_2h', SettingsHandler.handleToggleGame2h);
bot.action('toggle_organizer_notifications', SettingsHandler.handleToggleOrganizerNotifications);

// Выбор организаторов
bot.action(/^toggle_organizer_(.+)$/, async (ctx) => {
  await OrganizerSelectionHandler.handleToggleOrganizer(ctx, ctx.match[0]);
});
bot.action('organizers_done', OrganizerSelectionHandler.handleOrganizersDone);

// Приглашения
bot.action(/^respond_game_(.+)_yes$/, async (ctx) => {
  await InvitationHandler.handleRespondGameYes(ctx, ctx.match[0]);
});
bot.action(/^respond_game_(.+)_no$/, async (ctx) => {
  await InvitationHandler.handleRespondGameNo(ctx, ctx.match[0]);
});

// Мастер создания игры
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

// Обработчики текстовых сообщений
bot.on('text', CommonHandlers.handleUnknownCommand);

// Глобальный обработчик ошибок
bot.catch((err: unknown, ctx) => CommonHandlers.handleError(err as Error, ctx));

export { bot };