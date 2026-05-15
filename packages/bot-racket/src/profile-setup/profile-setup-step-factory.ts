import { LoggerFactory } from '../../../core/src/shared/layer-logger.js';
import { sessionManager } from '../../../core/src/shared/session-manager.js';
import { StepFactory } from './step-factory.js';
import { buildTennisProfileSummaryMessage, persistRacketProfileFromWizardState } from './profile-setup-persist.js';
import DayTimeService from './services/day-time.js';
import PlayLevelService from './services/play-level.js';
import PreferredAgeService from './services/prefer-age.js';
import PreferredGenderService from './services/prefer-gender.js';
import WeekDayService from './services/week-day.js';
import type {
  DayTime,
  DayTimeAction,
  PlayLevelAction,
  PreferredAgeAction,
  PreferredGenderAction,
  ProfileSetupActions,
  ProfileSetupWizardContext,
  StepKey,
  WeekDay,
  WeekDayAction,
} from './types.js';
import { DayTimeStep } from './steps/day-time.js';
import { PlayLevelStep } from './steps/play-level.js';
import { PreferredAgeStep } from './steps/preferred-age.js';
import { PreferredGenderStep } from './steps/preferred-gender.js';
import { WeekDayStep } from './steps/week-day.js';
import { TennisText } from './tennis-text.js';

const log = LoggerFactory.bot('tennis-profile-setup');

function isMultiSportOnboardingSession(): boolean {
  const raw = sessionManager.getCurrentSession()?.data?.onboardingChosenSports;
  return Array.isArray(raw) && raw.length > 0;
}

const playLevelStep = new PlayLevelStep();
const weekDayStep = new WeekDayStep();
const dayTimeStep = new DayTimeStep();
const preferredAgeStep = new PreferredAgeStep();
const preferredGenderStep = new PreferredGenderStep();

/** Порядок: уровень → предпочтения партнёров (пол, возраст) → дни → время. Пол/возраст игрока — из `User` при сохранении. */
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
      name: PreferredGenderService.PreferredGenderStepName,
      step: {
        execute: ctx => preferredGenderStep.execute(ctx),
        handleInput: (ctx, action: Extract<ProfileSetupActions, PreferredGenderAction>) =>
          preferredGenderStep.handleInput(ctx, action),
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
      name: WeekDayService.WeekDayStepName,
      step: {
        execute: ctx => weekDayStep.execute(ctx),
        handleInput: (ctx, action: Extract<ProfileSetupActions, WeekDayAction>) =>
          weekDayStep.handleInput(ctx, action),
      },
    },
    {
      name: DayTimeService.DayTimeStepName,
      beforeRewindToPrevious: ctx => {
        const cursor = ctx.wizard.state.dayTimeCursorDay;
        if (!cursor) return;
        const times = ctx.wizard.state.dayTimes as Record<WeekDay, DayTime[]> | undefined;
        if (times && Object.prototype.hasOwnProperty.call(times, cursor)) {
          delete times[cursor];
        }
        ctx.wizard.state.dayTimeCursorDay = undefined;
      },
      step: {
        execute: ctx => dayTimeStep.execute(ctx),
        handleInput: (ctx, action: Extract<ProfileSetupActions, DayTimeAction>) =>
          dayTimeStep.handleInput(ctx, action),
      },
    },
  ],
  defaultStep: PlayLevelService.playLevelStepName,
  finalizeFunction: async ctx => {
    const telegramId = ctx.from?.id;
    if (telegramId === undefined) {
      log.warn('finalize', 'wizard finalize without from.id', {});
      return;
    }

    const s = ctx.wizard.state;

    const callbackQueryIdForErrors = ctx.callbackQuery?.id;
    const wasTennisOnboardingEditBeforePersist = Boolean(sessionManager.getCurrentSession()?.data?.onboardingEdit);

    try {
      await persistRacketProfileFromWizardState(telegramId, s);
    } catch (e) {
      const err = e as Error;
      const mapMsg = (): string => {
        if (err.message === 'USER_NOT_FOUND') return TennisText.errUserNotFound;
        if (err.message === 'INCOMPLETE_WIZARD_STATE') return TennisText.errIncompleteWizard;
        if (err.message === 'INCOMPLETE_USER_DEMOGRAPHICS') return TennisText.errIncompleteDemographics;
        log.error('finalize', 'failed to persist tennis profile', err, { telegramId });
        return TennisText.errPersistFailed;
      };
      const msg = mapMsg();
      try {
        if (ctx.callbackQuery?.message && !ctx.callbackQuery.inline_message_id) {
          await ctx.editMessageText(`❌ ${msg}`, { reply_markup: { inline_keyboard: [] } });
        } else {
          await ctx.reply(`❌ ${msg}`);
        }
      } catch {
        await ctx.reply(`❌ ${msg}`);
      }
      if (wasTennisOnboardingEditBeforePersist && callbackQueryIdForErrors) {
        const toast =
          msg.length > TennisText.cbToastMaxLen
            ? `${msg.slice(0, TennisText.cbToastMaxLen - TennisText.cbToastTruncateSuffix.length)}${TennisText.cbToastTruncateSuffix}`
            : msg;
        await ctx.telegram.answerCbQuery(callbackQueryIdForErrors, toast).catch(() => {});
      }
      return;
    }

    await ctx.editMessageText(await buildTennisProfileSummaryMessage(telegramId, s), {
      reply_markup: { inline_keyboard: [] },
    });

    const callbackQueryId = ctx.callbackQuery?.id;
    const wasTennisOnboardingEdit = Boolean(sessionManager.getCurrentSession()?.data?.onboardingEdit);

    if (!isMultiSportOnboardingSession() && !wasTennisOnboardingEdit) {
      await ctx.reply(TennisText.savedStandalone, {
        reply_markup: { remove_keyboard: true },
      });
    }

    const { invokeTennisProfileSaved } = await import('./profile-complete-bridge.js');
    await invokeTennisProfileSaved(ctx);

    if (wasTennisOnboardingEdit && callbackQueryId) {
      await ctx.telegram.answerCbQuery(callbackQueryId, TennisText.savedEditToast).catch(() => {});
    }
  },
});
