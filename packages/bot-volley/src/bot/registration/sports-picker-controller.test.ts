import { describe, it, expect, jest, beforeEach } from '@jest/globals';

const startNextSport = jest.fn(async () => undefined);
const setUserDemographics = jest.fn(async () => undefined);

jest.unstable_mockModule('../../../../core/src/application/use-cases.js', () => ({
  setUserDemographics,
}));

jest.unstable_mockModule('./onboarding-flow-controller.js', () => ({
  OnboardingFlowController: { startNextSport },
}));

const { prisma } = await import('../../../../core/src/infrastructure/prisma.js');
const { sessionManager } = await import('../../../../core/src/shared/session-manager.js');
const { OnbCallback } = await import('./onboarding-callbacks.js');
const { OnbText } = await import('./onboarding-text.js');
const { SportsPickerController } = await import('./sports-picker-controller.js');
const { createMockCallbackContext } = await import('./test-helpers/telegraf-context.js');

describe('SportsPickerController', () => {
  beforeEach(() => {
    sessionManager.terminate();
    sessionManager.create('test-user');
    jest.clearAllMocks();
  });

  it('handleToggleVolleyball toggles sport in session order', async () => {
    const ctx = createMockCallbackContext();
    await SportsPickerController.handleToggleVolleyball(ctx);
    expect(ctx.editMessageReplyMarkup).toHaveBeenCalled();
    expect(ctx.answerCbQuery).toHaveBeenCalled();
  });

  it('handleSportsDone without selection shows toast', async () => {
    const ctx = createMockCallbackContext({ data: OnbCallback.sportDone });
    jest.spyOn(SportsPickerController, 'requireUser').mockResolvedValue({
      id: 'u1',
      gender: 'men',
      ageBand: 'after-thirty',
    } as never);
    jest.spyOn(prisma.userSportProfile, 'findMany').mockResolvedValue([]);
    await SportsPickerController.handleSportsDone(ctx);
    expect(ctx.telegram.answerCbQuery).toHaveBeenCalledWith(
      'cb_test',
      OnbText.errPickMissingSport,
      expect.anything(),
    );
  });

  it('handleSportsDone with demographics starts next sport', async () => {
    const session = sessionManager.getCurrentSession()!;
    session.data.sportPickOrder = ['volleyball'];
    const ctx = createMockCallbackContext({ data: OnbCallback.sportDone });
    jest.spyOn(SportsPickerController, 'requireUser').mockResolvedValue({
      id: 'u1',
      gender: 'men',
      ageBand: 'after-thirty',
    } as never);
    jest.spyOn(prisma.userSportProfile, 'findMany').mockResolvedValue([]);
    await SportsPickerController.handleSportsDone(ctx);
    expect(startNextSport).toHaveBeenCalledWith(ctx, 'volleyball');
  });

  it('handlePartialAdd shows keyboard only for missing sports', async () => {
    const ctx = createMockCallbackContext();
    jest.spyOn(SportsPickerController, 'requireUser').mockResolvedValue({ id: 'u1' } as never);
    jest.spyOn(prisma.userSportProfile, 'findMany').mockResolvedValue([{ sport: 'volleyball' }] as never);
    await SportsPickerController.handlePartialAdd(ctx);
    const markup = (ctx.editMessageText as jest.Mock).mock.calls[0]![1] as {
      reply_markup: { inline_keyboard: { text: string }[][] };
    };
    const labels = markup.reply_markup.inline_keyboard.flat().map(b => b.text);
    expect(labels.some(t => /теннис/i.test(t))).toBe(true);
    expect(labels.some(t => /волейбол/i.test(t))).toBe(false);
  });

  it('handleDemoGender shows age keyboard after selection', async () => {
    const ctx = createMockCallbackContext({ data: OnbCallback.demoGenderMen });
    jest.spyOn(SportsPickerController, 'requireUser').mockResolvedValue({ id: 'u1' } as never);
    await SportsPickerController.handleDemoGender(ctx, 'men');
    expect(setUserDemographics).toHaveBeenCalledWith('u1', { gender: 'men' });
    expect(ctx.editMessageText).toHaveBeenCalledWith(OnbText.demoAgeTitle, expect.anything());
  });
});
