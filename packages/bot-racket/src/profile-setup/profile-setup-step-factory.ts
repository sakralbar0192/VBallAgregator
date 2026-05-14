import { Markup } from 'telegraf';
import { LoggerFactory } from '../../../core/src/shared/layer-logger.js';
import { StepFactory } from './step-factory.js';
import { buildRacketProfileSummaryMessage, persistRacketProfileFromWizardState } from './profile-setup-persist.js';
import DayTimeService from './services/day-time.js';
import PlayLevelService from './services/play-level.js';
import PlayerAgeService from './services/player-age.js';
import PlayerGenderService from './services/player-gender.js';
import PreferredAgeService from './services/prefer-age.js';
import PreferredGenderService from './services/prefer-gender.js';
import WeekDayService from './services/week-day.js';
import type {
  DayTimeAction,
  PlayLevelAction,
  PlayerAgeAction,
  PlayerGenderAction,
  PreferredAgeAction,
  PreferredGenderAction,
  ProfileSetupActions,
  ProfileSetupWizardContext,
  StepKey,
  WeekDayAction,
} from './types.js';
import { DayTimeStep } from './steps/day-time.js';
import { PlayLevelStep } from './steps/play-level.js';
import { PlayerAgeStep } from './steps/player-age.js';
import { PlayerGenderStep } from './steps/player-gender.js';
import { PreferredAgeStep } from './steps/preferred-age.js';
import { PreferredGenderStep } from './steps/preferred-gender.js';
import { WeekDayStep } from './steps/week-day.js';

const log = LoggerFactory.bot('racket-profile-setup');

const playLevelStep = new PlayLevelStep();
const playerAgeStep = new PlayerAgeStep();
const playerGenderStep = new PlayerGenderStep();
const weekDayStep = new WeekDayStep();
const dayTimeStep = new DayTimeStep();
const preferredAgeStep = new PreferredAgeStep();
const preferredGenderStep = new PreferredGenderStep();

export const profileSetupStepFactory = new StepFactory<StepKey, ProfileSetupActions, ProfileSetupWizardContext>({
  steps: [
    {
      name: PlayLevelService.playLevelStepName,
      step: {
        execute: ctx => playLevelStep.execute(ctx),
        handleInput: (ctx, action: Extract<ProfileSetupActions, PlayLevelAction>) =>
          playLevelStep.handleInput(ctx, action),
      },
    },
    {
      name: PlayerAgeService.playerAgeStepName,
      step: {
        execute: ctx => playerAgeStep.execute(ctx),
        handleInput: (ctx, action: Extract<ProfileSetupActions, PlayerAgeAction>) =>
          playerAgeStep.handleInput(ctx, action),
      },
    },
    {
      name: PlayerGenderService.playerGenderStepName,
      step: {
        execute: ctx => playerGenderStep.execute(ctx),
        handleInput: (ctx, action: Extract<ProfileSetupActions, PlayerGenderAction>) =>
          playerGenderStep.handleInput(ctx, action),
      },
    },
    {
      name: WeekDayService.WeekDayStepName,
      step: {
        execute: ctx => weekDayStep.execute(ctx),
        handleInput: (ctx, action: Extract<ProfileSetupActions, WeekDayAction>) =>
          weekDayStep.handleInput(ctx, action),
      },
    },
    {
      name: DayTimeService.DayTimeStepName,
      step: {
        execute: ctx => dayTimeStep.execute(ctx),
        handleInput: (ctx, action: Extract<ProfileSetupActions, DayTimeAction>) =>
          dayTimeStep.handleInput(ctx, action),
      },
    },
    {
      name: PreferredAgeService.PreferredAgeStepName,
      step: {
        execute: ctx => preferredAgeStep.execute(ctx),
        handleInput: (ctx, action: Extract<ProfileSetupActions, PreferredAgeAction>) =>
          preferredAgeStep.handleInput(ctx, action),
      },
    },
    {
      name: PreferredGenderService.PreferredGenderStepName,
      step: {
        execute: ctx => preferredGenderStep.execute(ctx),
        handleInput: (ctx, action: Extract<ProfileSetupActions, PreferredGenderAction>) =>
          preferredGenderStep.handleInput(ctx, action),
      },
    },
  ],
  defaultStep: PlayLevelService.playLevelStepName,
  finalizeFunction: async ctx => {
    // Не вызывать answerCbQuery здесь: последний шаг wizard уже ответил на callback;
    // повторный ответ даёт ошибку API, finalize прерывается и сцена не покидается.

    const telegramId = ctx.from?.id;
    if (telegramId === undefined) {
      log.warn('finalize', 'wizard finalize without from.id', {});
      return;
    }

    const s = ctx.wizard.state;

    try {
      await persistRacketProfileFromWizardState(telegramId, s);
    } catch (e) {
      const err = e as Error;
      if (err.message === 'USER_NOT_FOUND') {
        await ctx.reply('Пользователь не найден. Начни с /start.');
        return;
      }
      if (err.message === 'INCOMPLETE_WIZARD_STATE') {
        await ctx.reply('Не хватает данных профиля. Пройди настройку ещё раз.');
        return;
      }
      log.error('finalize', 'failed to persist racket profile', err, { telegramId });
      await ctx.reply('Не удалось сохранить профиль. Попробуй позже.');
      return;
    }

    await ctx.editMessageText(buildRacketProfileSummaryMessage(s));

    await ctx.reply(
      'Отлично, профиль настроен! Теперь вы можете искать подходящие игры!',
      Markup.keyboard(['Редактировать профиль', 'Искать игры']).resize(),
    );
  },
});
