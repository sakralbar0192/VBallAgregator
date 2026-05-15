import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { sessionManager } from '../../../../core/src/shared/session-manager.js';
import { OnbCallback, vbWeekDayDoneCallback, vbTimeDoneCallback } from './onboarding-callbacks.js';
import { OnbText } from './onboarding-text.js';
import { VolleyballWizardController } from './volleyball-wizard-controller.js';
import { createMockCallbackContext } from './test-helpers/telegraf-context.js';
import { getOnboardingSession } from './onboarding-session.js';

jest.mock('./onboarding-flow-controller.js', () => ({
  OnboardingFlowController: {
    finishVolleyballData: jest.fn(async () => undefined),
  },
}));

jest.mock('../../../../core/src/infrastructure/prisma.js', () => ({
  prisma: {
    organizer: { findMany: jest.fn(async () => []) },
  },
}));

describe('VolleyballWizardController', () => {
  beforeEach(() => {
    sessionManager.terminate();
    sessionManager.create('vb-user');
    jest.clearAllMocks();
  });

  it('vbFormatsDone without format shows toast', async () => {
    const ctx = createMockCallbackContext({ data: OnbCallback.vbFormatDone });
    await VolleyballWizardController.vbFormatsDone(ctx);
    expect(ctx.telegram.answerCbQuery).toHaveBeenCalledWith('cb_test', OnbText.errPickFormat, expect.anything());
  });

  it('vbWeekToggle done without days shows toast', async () => {
    const ctx = createMockCallbackContext({ data: vbWeekDayDoneCallback() });
    getOnboardingSession().vbWeekDays = [];
    await VolleyballWizardController.vbWeekToggle(ctx, vbWeekDayDoneCallback());
    expect(ctx.telegram.answerCbQuery).toHaveBeenCalledWith('cb_test', OnbText.errPickWeekDay, expect.anything());
  });

  it('vbTimeToggle done without slots shows toast', async () => {
    const data = getOnboardingSession();
    data.vbWeekDays = ['monday'];
    data.vbCursorDay = 'monday';
    data.vbDayTimes = { monday: [] } as never;
    const ctx = createMockCallbackContext({ data: vbTimeDoneCallback('monday') });
    await VolleyballWizardController.vbTimeToggle(ctx, vbTimeDoneCallback('monday'));
    expect(ctx.telegram.answerCbQuery).toHaveBeenCalledWith('cb_test', OnbText.errPickTimeForDay, expect.anything());
  });

  it('vbWizardBack from time on first day clears slots and returns to week days', async () => {
    const data = getOnboardingSession();
    data.vbUiPhase = 'tm';
    data.vbWeekDays = ['monday'];
    data.vbCursorDay = 'monday';
    data.vbDayTimes = { monday: ['ten-am'] } as never;
    const ctx = createMockCallbackContext({ data: OnbCallback.vbWizardBack });
    await VolleyballWizardController.vbWizardBack(ctx);
    expect(data.vbUiPhase).toBe('wd');
    expect(data.vbDayTimes?.monday).toBeUndefined();
    expect(ctx.editMessageText).toHaveBeenCalledWith(OnbText.vbWeekDays, expect.anything());
  });
});
