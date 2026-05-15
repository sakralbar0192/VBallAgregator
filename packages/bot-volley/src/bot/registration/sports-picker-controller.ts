import type { Context } from 'telegraf';
import { setUserDemographics } from '../../../../core/src/application/use-cases.js';
import { prisma } from '../../../../core/src/infrastructure/prisma.js';
import { BaseHandler } from '../common/base-handler.js';
import { CATALOG_SPORTS, type CatalogSport, type DemoGender } from './onboarding-constants.js';
import {
  demoAgeKeyboard,
  demoGenderKeyboard,
  partialAddSportKeyboard,
  returningEditSportKeyboard,
  returningFullKeyboard,
  returningPartialKeyboard,
  sportPickKeyboard,
} from './onboarding-keyboards.js';
import { getOnboardingSession } from './onboarding-session.js';
import { OnbText } from './onboarding-text.js';
import {
  beginPartialAdd,
  commitSportOrder,
  filterOrderToMissingSports,
  sportPickReplyMarkup,
  toggleSportInOrder,
} from './sport-selection-state.js';
import { toastCbQuery } from './onboarding-ui.js';
import { OnboardingFlowController } from './onboarding-flow-controller.js';

export class SportsPickerController extends BaseHandler {
  static async handleToggleVolleyball(ctx: Context): Promise<void> {
    const data = getOnboardingSession();
    toggleSportInOrder(data, 'volleyball');
    await ctx.editMessageReplyMarkup(sportPickReplyMarkup(data));
    await ctx.answerCbQuery();
  }

  static async handleToggleTennis(ctx: Context): Promise<void> {
    const data = getOnboardingSession();
    toggleSportInOrder(data, 'tennis');
    await ctx.editMessageReplyMarkup(sportPickReplyMarkup(data));
    await ctx.answerCbQuery();
  }

  static async handleSportsDone(ctx: Context): Promise<void> {
    const data = getOnboardingSession();
    const user = await SportsPickerController.requireUser(ctx);
    const completed = new Set(
      (await prisma.userSportProfile.findMany({ where: { userId: user.id } })).map(
        p => p.sport as CatalogSport,
      ),
    );
    const order = filterOrderToMissingSports(data.sportPickOrder ?? [], completed);
    if (!order.length) {
      await toastCbQuery(ctx, OnbText.errPickMissingSport);
      return;
    }
    await ctx.answerCbQuery();
    commitSportOrder(data, order);
    if (!user.gender?.trim() || !user.ageBand?.trim()) {
      await ctx.editMessageText(OnbText.demoGenderTitle, { reply_markup: demoGenderKeyboard() });
      return;
    }
    await OnboardingFlowController.startNextSport(ctx, order[0]!);
  }

  static async handleDemoGender(ctx: Context, gender: DemoGender): Promise<void> {
    await ctx.answerCbQuery();
    const user = await SportsPickerController.requireUser(ctx);
    await setUserDemographics(user.id, { gender });
    await ctx.editMessageText(OnbText.demoAgeTitle, { reply_markup: demoAgeKeyboard() });
  }

  static async handleDemoAge(ctx: Context, band: string): Promise<void> {
    const user = await SportsPickerController.requireUser(ctx);
    await setUserDemographics(user.id, { ageBand: band });
    const first = getOnboardingSession().sportPickOrder?.[0];
    if (!first) {
      await toastCbQuery(ctx, OnbText.errSessionStale, true);
      return;
    }
    await ctx.answerCbQuery();
    await OnboardingFlowController.startNextSport(ctx, first);
  }

  static async handlePartialEdit(ctx: Context): Promise<void> {
    await ctx.answerCbQuery();
    const user = await SportsPickerController.requireUser(ctx);
    const completed = new Set(
      (await prisma.userSportProfile.findMany({ where: { userId: user.id } })).map(
        p => p.sport as CatalogSport,
      ),
    );
    await ctx.editMessageText(OnbText.partialWhichProfile, {
      reply_markup: returningEditSportKeyboard([...completed]),
    });
  }

  static async handlePartialAdd(ctx: Context): Promise<void> {
    await ctx.answerCbQuery();
    const user = await SportsPickerController.requireUser(ctx);
    const completed = new Set(
      (await prisma.userSportProfile.findMany({ where: { userId: user.id } })).map(
        p => p.sport as CatalogSport,
      ),
    );
    const missing = CATALOG_SPORTS.filter(s => !completed.has(s));
    const data = getOnboardingSession();
    beginPartialAdd(data, missing);
    await ctx.editMessageText(OnbText.partialPickSport, {
      reply_markup: partialAddSportKeyboard(missing, data.sportPickOrder ?? []),
    });
  }

  static sportPickKeyboard(order: CatalogSport[]) {
    return sportPickKeyboard(order);
  }

  static returningFullKeyboard() {
    return returningFullKeyboard();
  }

  static returningPartialKeyboard() {
    return returningPartialKeyboard();
  }
}
