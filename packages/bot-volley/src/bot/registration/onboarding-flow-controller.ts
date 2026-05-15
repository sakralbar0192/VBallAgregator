import type { Context } from 'telegraf';
import { Scenes } from 'telegraf';
import { registerOrganizer, registerUser, setUserActiveSport } from '../../../../core/src/application/use-cases.js';
import { prisma } from '../../../../core/src/infrastructure/prisma.js';
import { sessionManager } from '../../../../core/src/shared/session-manager.js';
import { LoggerFactory } from '../../../../core/src/shared/layer-logger.js';
import { BaseHandler } from '../common/base-handler.js';
import { setTennisProfileSavedHandler } from '../../../../bot-racket/src/profile-setup/profile-complete-bridge.js';
import { TENNIS_SCENE_ID } from '../../../../bot-racket/src/profile-setup/tennis-callbacks.js';
import type { CatalogSport } from './onboarding-constants.js';
import { CATALOG_SPORTS } from './onboarding-constants.js';
import {
  returningFullKeyboard,
  returningPartialKeyboard,
  sportPickKeyboard,
} from './onboarding-keyboards.js';
import { getOnboardingSession } from './onboarding-session.js';
import { OnbText } from './onboarding-text.js';
import { editOrReplyInlinePanel, hasEditableCallbackMessage } from './onboarding-ui.js';
import {
  buildVolleyballProfileCompletionMessage,
  emptyVolleyballFormats,
  loadVolleyballDraftFromDb,
  persistVolleyballProfile,
  resetVolleyballDraftForNewSport,
} from './volleyball-onboarding-state.js';
import { volleyballFormatsKeyboard } from './volleyball-onboarding-keyboards.js';

const log = LoggerFactory.bot('onboarding-flow');

async function finalizeOrganizerIfNeeded(ctx: Context, userId: string): Promise<void> {
  const vb = await prisma.userSportProfile.findUnique({
    where: { userId_sport: { userId, sport: 'volleyball' } },
  });
  const existingOrg = await prisma.organizer.findUnique({ where: { userId } });
  if (vb?.wantsOrganizeVolleyball && !existingOrg) {
    await registerOrganizer(userId, ctx.from?.first_name ?? OnbText.defaultOrganizerName);
  }
}

export class OnboardingFlowController extends BaseHandler {
  protected static override logger = log;

  static registerTennisBridge(): void {
    setTennisProfileSavedHandler(async ctx => {
      await OnboardingFlowController.afterTennisProfileSaved(ctx as Context);
    });
  }

  static async handleStart(ctx: Context): Promise<void> {
    const telegramId = ctx.from!.id;
    const name = ctx.from!.first_name + (ctx.from!.last_name ? ' ' + ctx.from!.last_name : '');
    const correlationId = OnboardingFlowController.createCorrelationId(ctx, 'start');
    try {
      const sc = ctx as unknown as Scenes.SceneContext;
      if (sc.scene) {
        try {
          await sc.scene.leave();
        } catch {
          /* не в сцене */
        }
      }

      const result = await registerUser(telegramId, name);
      const session = sessionManager.create(result.userId.toString());
      session.data.telegramId = telegramId;
      session.data.name = name;

      const user = await prisma.user.findUnique({
        where: { telegramId: BigInt(telegramId) },
        include: { sportProfiles: true },
      });
      if (!user) throw new Error('USER_MISSING');

      const completed = new Set(user.sportProfiles.map(p => p.sport as CatalogSport));
      const missing = CATALOG_SPORTS.filter(s => !completed.has(s));

      if (completed.size === 0) {
        getOnboardingSession().sportPickOrder = [];
        await ctx.reply(OnbText.startNewUser, { reply_markup: sportPickKeyboard([]) });
        return;
      }

      if (missing.length === 0) {
        await ctx.reply(OnbText.startAllSportsConfigured, { reply_markup: returningFullKeyboard() });
        return;
      }

      await ctx.reply(
        OnbText.startPartialConfigured([...completed].join(', '), missing.join(', ')),
        { reply_markup: returningPartialKeyboard() },
      );
    } catch (e) {
      OnboardingFlowController.logger.error('handleStart', 'start failed', e as Error, {
        telegramId,
        correlationId,
      });
      throw e;
    }
  }

  static async startNextSport(ctx: Context, sport: CatalogSport): Promise<void> {
    const data = getOnboardingSession();
    if (sport === 'tennis') {
      await setUserActiveSport((await OnboardingFlowController.requireUser(ctx)).id, 'tennis');
      if (hasEditableCallbackMessage(ctx)) {
        await ctx.editMessageText(OnbText.tennisSetup);
      } else {
        await ctx.reply(OnbText.tennisSetup);
      }
      await (ctx as unknown as Scenes.SceneContext).scene.enter(TENNIS_SCENE_ID);
      return;
    }
    await setUserActiveSport((await OnboardingFlowController.requireUser(ctx)).id, 'volleyball');
    if (!data.onboardingEdit) {
      resetVolleyballDraftForNewSport(data);
    }
    const fmt = data.vbFormats ?? emptyVolleyballFormats();
    data.vbUiPhase = 'fmt';
    await editOrReplyInlinePanel(
      ctx,
      data.onboardingEdit ? OnbText.vbFormatsEdit : OnbText.vbFormatsNew,
      volleyballFormatsKeyboard(fmt),
    );
  }

  static async finishVolleyballData(ctx: Context): Promise<void> {
    const user = await OnboardingFlowController.requireUser(ctx);
    const data = getOnboardingSession();
    await persistVolleyballProfile(user.id, data);
    delete data.vbUiPhase;
    const summary = buildVolleyballProfileCompletionMessage(data);
    const wasEdit = Boolean(data.onboardingEdit);
    if (wasEdit) {
      data.onboardingEdit = false;
    }
    if (hasEditableCallbackMessage(ctx)) {
      await ctx.editMessageText(summary, { reply_markup: { inline_keyboard: [] } });
    } else {
      await ctx.reply(summary);
    }
    if (wasEdit) {
      return;
    }
    await OnboardingFlowController.advanceQueue(ctx);
  }

  static async finishVolleyballAfterOrganizers(ctx: Context): Promise<void> {
    await OnboardingFlowController.finishVolleyballData(ctx);
  }

  static buildOnboardingGamesDiscoveryBody(sports: CatalogSport[]): string {
    const uniq = [...new Set(sports)];
    const lines: string[] = [OnbText.discoveryHeader];
    if (uniq.includes('volleyball')) lines.push(OnbText.discoveryVolleyball);
    if (uniq.includes('tennis')) lines.push(OnbText.discoveryTennis);
    return lines.join('\n\n');
  }

  static async advanceQueue(ctx: Context): Promise<void> {
    const data = getOnboardingSession();
    const next = data.onboardingRemain?.shift();
    if (next) {
      await ctx.reply(OnbText.queueNextSport(next), { reply_markup: { remove_keyboard: true } });
      await OnboardingFlowController.startNextSport(ctx, next);
      return;
    }
    await OnboardingFlowController.finalizeSession(ctx);
  }

  static async finalizeSession(ctx: Context): Promise<void> {
    const user = await OnboardingFlowController.requireUser(ctx);
    await finalizeOrganizerIfNeeded(ctx, user.id);
    const data = getOnboardingSession();
    const sports = data.onboardingChosenSports ? [...data.onboardingChosenSports] : [];
    delete data.onboardingChosenSports;
    delete data.sportPickOrder;
    const text =
      sports.length > 0
        ? OnboardingFlowController.buildOnboardingGamesDiscoveryBody(sports)
        : OnbText.registrationDone;
    await ctx.reply(text, { reply_markup: { remove_keyboard: true } });
  }

  static async afterTennisProfileSaved(ctx: Context): Promise<void> {
    if (getOnboardingSession().onboardingEdit) {
      getOnboardingSession().onboardingEdit = false;
      return;
    }
    await OnboardingFlowController.advanceQueue(ctx);
  }

  static async handleReturningPick(ctx: Context, sport: CatalogSport): Promise<void> {
    await ctx.answerCbQuery();
    const data = getOnboardingSession();
    data.onboardingEdit = true;
    data.onboardingRemain = [];
    delete data.onboardingChosenSports;
    if (sport === 'tennis') {
      await setUserActiveSport((await OnboardingFlowController.requireUser(ctx)).id, 'tennis');
      if (hasEditableCallbackMessage(ctx)) {
        await ctx.editMessageText(OnbText.tennisSetup);
      } else {
        await ctx.reply(OnbText.tennisSetup);
      }
      await (ctx as unknown as Scenes.SceneContext).scene.enter(TENNIS_SCENE_ID);
      return;
    }
    await OnboardingFlowController.loadVolleyballForEdit(ctx);
  }

  static async loadVolleyballForEdit(ctx: Context): Promise<void> {
    const user = await OnboardingFlowController.requireUser(ctx);
    const data = getOnboardingSession();
    await loadVolleyballDraftFromDb(user.id, data);
    data.vbUiPhase = 'fmt';
    const fmt = data.vbFormats ?? emptyVolleyballFormats();
    await editOrReplyInlinePanel(ctx, OnbText.vbFormatsEdit, volleyballFormatsKeyboard(fmt));
  }
}
