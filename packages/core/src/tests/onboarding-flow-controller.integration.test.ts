import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { Scenes } from 'telegraf';
import { prisma } from '../infrastructure/prisma.js';
import { sessionManager } from '../shared/session-manager.js';
import { clearDatabase } from './test-db-helpers.js';
import { OnboardingFlowController } from '../../../bot-volley/src/bot/registration/onboarding-flow-controller.js';
import { OnbText } from '../../../bot-volley/src/bot/registration/onboarding-text.js';
import { createMockCallbackContext } from '../../../bot-volley/src/bot/registration/test-helpers/telegraf-context.js';

describe('OnboardingFlowController.handleStart (integration)', () => {
  beforeEach(async () => {
    sessionManager.terminate();
    await clearDatabase();
  });

  afterEach(async () => {
    sessionManager.terminate();
    await clearDatabase();
  });

  it('creates session and shows sport picker for new telegram user', async () => {
    const ctx = createMockCallbackContext({ userId: 800_001 });
    (ctx as unknown as Scenes.SceneContext).scene = {
      leave: async () => undefined,
    } as Scenes.SceneContext['scene'];

    await OnboardingFlowController.handleStart(ctx);

    expect(ctx.reply).toHaveBeenCalledWith(OnbText.startNewUser, expect.anything());
    const user = await prisma.user.findUnique({ where: { telegramId: BigInt(800_001) } });
    expect(user).not.toBeNull();
    expect(sessionManager.getCurrentSession()?.data.telegramId).toBe(800_001);
  });
});
