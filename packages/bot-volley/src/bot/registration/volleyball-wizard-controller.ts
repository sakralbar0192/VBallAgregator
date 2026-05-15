import type { Context } from 'telegraf';
import WeekDayService from '../../../../bot-racket/src/profile-setup/services/week-day.js';
import type { DayTime, WeekDay } from '../../../../bot-racket/src/profile-setup/types.js';
import { VB_TM_PREFIX, VB_WD_PREFIX } from './onboarding-callbacks.js';
import { vbOrganizeKeyboard } from './onboarding-keyboards.js';
import { getOnboardingSession } from './onboarding-session.js';
import { OnbText } from './onboarding-text.js';
import { editOrReplyInlinePanel, hasEditableCallbackMessage, toastCbQuery } from './onboarding-ui.js';
import type { VolleyballFormatKey } from './onboarding-constants.js';
import { ORGANIZER_LOOKUP_LIMIT } from './onboarding-constants.js';
import {
  advanceVolleyballTimeCursor,
  beginVolleyballTimeWalk,
  clearVolleyballTimeForDay,
  emptyVolleyballFormats,
  hasAnyVolleyballFormat,
  setVolleyballLevel,
  setVolleyballUiPhase,
  toggleVolleyballFormat,
  toggleVolleyballTimeSlot,
  toggleVolleyballWeekDay,
  volleyballTimesForDay,
} from './volleyball-onboarding-state.js';
import {
  volleyballFormatsKeyboard,
  volleyballLevelKeyboard,
  volleyballTimeKeyboardForDay,
  volleyballWeekKeyboard,
} from './volleyball-onboarding-keyboards.js';
import { OnboardingFlowController } from './onboarding-flow-controller.js';
import { prisma } from '../../../../core/src/infrastructure/prisma.js';
import { CommandHandlers } from '../command-handlers.js';
import { BaseHandler } from '../common/base-handler.js';

export class VolleyballWizardController extends BaseHandler {
  static async vbFormatToggle(ctx: Context, key: VolleyballFormatKey): Promise<void> {
    const data = getOnboardingSession();
    toggleVolleyballFormat(data, key);
    await ctx.editMessageReplyMarkup(volleyballFormatsKeyboard(data.vbFormats!));
    await ctx.answerCbQuery();
  }

  static async vbFormatsDone(ctx: Context): Promise<void> {
    const data = getOnboardingSession();
    if (!hasAnyVolleyballFormat(data)) {
      await toastCbQuery(ctx, OnbText.errPickFormat);
      return;
    }
    await ctx.answerCbQuery();
    setVolleyballUiPhase(data, 'lvl');
    await ctx.editMessageText(OnbText.vbLevel, {
      reply_markup: volleyballLevelKeyboard(data.vbLevelKey),
    });
  }

  static async vbWizardBack(ctx: Context): Promise<void> {
    const data = getOnboardingSession();
    const phase = data.vbUiPhase;
    switch (phase) {
      case 'org': {
        setVolleyballUiPhase(data, 'tm');
        const days = data.vbWeekDays ?? [];
        data.vbCursorDay = days.length ? days[days.length - 1]! : null;
        await VolleyballWizardController.vbPromptTimeForCursor(ctx);
        break;
      }
      case 'tm': {
        const days = data.vbWeekDays ?? [];
        const cur = data.vbCursorDay;
        const ix = cur ? days.indexOf(cur) : -1;
        if (ix <= 0) {
          if (cur) clearVolleyballTimeForDay(data, cur);
          setVolleyballUiPhase(data, 'wd');
          data.vbCursorDay = null;
          await ctx.editMessageText(OnbText.vbWeekDays, {
            reply_markup: volleyballWeekKeyboard([...days]),
          });
        } else {
          data.vbCursorDay = days[ix - 1]!;
          await VolleyballWizardController.vbPromptTimeForCursor(ctx);
        }
        break;
      }
      case 'wd': {
        setVolleyballUiPhase(data, 'lvl');
        await ctx.editMessageText(OnbText.vbLevel, {
          reply_markup: volleyballLevelKeyboard(data.vbLevelKey),
        });
        break;
      }
      case 'lvl': {
        setVolleyballUiPhase(data, 'fmt');
        const fmt = data.vbFormats ?? emptyVolleyballFormats();
        const title = data.onboardingEdit ? OnbText.vbFormatsEdit : OnbText.vbFormatsNew;
        await ctx.editMessageText(title, { reply_markup: volleyballFormatsKeyboard(fmt) });
        break;
      }
      default:
        await toastCbQuery(ctx, OnbText.errVbWizardAtFirst);
        return;
    }
    await ctx.answerCbQuery();
  }

  static async vbLevel(ctx: Context, key: string): Promise<void> {
    const data = getOnboardingSession();
    setVolleyballLevel(data, key);
    await ctx.editMessageText(OnbText.vbWeekDays, {
      reply_markup: volleyballWeekKeyboard([...(data.vbWeekDays ?? [])]),
    });
    await ctx.answerCbQuery();
  }

  static async vbWeekToggle(ctx: Context, data: string): Promise<void> {
    const session = getOnboardingSession();
    session.vbWeekDays ??= [];
    if (data === `${VB_WD_PREFIX}done`) {
      if (!session.vbWeekDays.length) {
        await toastCbQuery(ctx, OnbText.errPickWeekDay);
        return;
      }
      beginVolleyballTimeWalk(session);
      await VolleyballWizardController.vbPromptTimeForCursor(ctx);
      await ctx.answerCbQuery();
      return;
    }
    const day = data.replace(VB_WD_PREFIX, '') as WeekDay;
    toggleVolleyballWeekDay(session, day);
    await ctx.editMessageReplyMarkup(volleyballWeekKeyboard([...(session.vbWeekDays ?? [])]));
    await ctx.answerCbQuery();
  }

  static async vbPromptTimeForCursor(ctx: Context): Promise<void> {
    const data = getOnboardingSession();
    const day = data.vbCursorDay;
    if (!day) {
      await VolleyballWizardController.vbAfterAllTimes(ctx);
      return;
    }
    data.vbDayTimes ??= {} as Record<WeekDay, DayTime[]>;
    setVolleyballUiPhase(data, 'tm');
    const cur = volleyballTimesForDay(data, day);
    const text = OnbText.vbTimeForDay(WeekDayService.daysOfWeek[day].name);
    const markup = volleyballTimeKeyboardForDay(day, cur);
    if (hasEditableCallbackMessage(ctx)) {
      await ctx.editMessageText(text, { reply_markup: markup });
    } else {
      await ctx.reply(text, { reply_markup: markup });
    }
  }

  static async vbTimeToggle(ctx: Context, data: string): Promise<void> {
    const session = getOnboardingSession();
    const raw = data.slice(VB_TM_PREFIX.length);
    const u = raw.indexOf('_');
    const day = raw.slice(0, u) as WeekDay;
    const slotPart = raw.slice(u + 1);
    session.vbDayTimes ??= {} as Record<WeekDay, DayTime[]>;
    if (slotPart === 'done') {
      if (!(session.vbDayTimes[day]?.length ?? 0)) {
        await toastCbQuery(ctx, OnbText.errPickTimeForDay);
        return;
      }
      const next = advanceVolleyballTimeCursor(session, day);
      if (next) {
        session.vbCursorDay = next;
        await VolleyballWizardController.vbPromptTimeForCursor(ctx);
      } else {
        await VolleyballWizardController.vbAfterAllTimes(ctx);
      }
      await ctx.answerCbQuery();
      return;
    }
    const slot = slotPart as DayTime;
    toggleVolleyballTimeSlot(session, day, slot);
    await ctx.editMessageReplyMarkup(
      volleyballTimeKeyboardForDay(day, volleyballTimesForDay(session, day)),
    );
    await ctx.answerCbQuery();
  }

  static async vbAfterAllTimes(ctx: Context): Promise<void> {
    const data = getOnboardingSession();
    setVolleyballUiPhase(data, 'org');
    await editOrReplyInlinePanel(ctx, OnbText.vbOrganize, vbOrganizeKeyboard(data.vbWantOrganize));
  }

  static async vbOrganize(ctx: Context, yes: boolean): Promise<void> {
    const data = getOnboardingSession();
    data.vbWantOrganize = yes;
    const user = await VolleyballWizardController.requireUser(ctx);
    const organizers = await prisma.organizer.findMany({
      where: { userId: { not: user.id } },
      take: ORGANIZER_LOOKUP_LIMIT,
    });
    if (organizers.length === 0) {
      await ctx.answerCbQuery();
      await OnboardingFlowController.finishVolleyballData(ctx);
      return;
    }
    data.onbAfterOrganizersContinue = true;
    await ctx.answerCbQuery();
    await CommandHandlers.handleSelectOrganizersSettings(ctx);
  }
}
