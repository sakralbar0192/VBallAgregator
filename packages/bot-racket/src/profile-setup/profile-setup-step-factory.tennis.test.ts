import { describe, it, expect, jest } from '@jest/globals';
import type { ProfileSetupWizardContext, WizardState } from './types.js';
import { profileSetupStepFactory } from './profile-setup-step-factory.js';
import PlayLevelService from './services/play-level.js';

/** Регрессия Telegraf: wizard.state должен быть тем же объектом, что scene.state. */
describe('profileSetupStepFactory scene state', () => {
  it('mutations on wizard.state are visible via shared scene.state object', async () => {
    const sceneState = {} as WizardState;
    const ctx = {
      wizard: {
        state: sceneState,
        next: jest.fn(),
        back: jest.fn(),
      },
      scene: { state: sceneState },
      from: { id: 1 },
      answerCbQuery: jest.fn(async () => true),
      reply: jest.fn(),
      editMessageText: jest.fn(),
    } as unknown as ProfileSetupWizardContext;

    jest
      .spyOn(profileSetupStepFactory.steps.get(PlayLevelService.playLevelStepName)!.step, 'execute')
      .mockResolvedValue(undefined);

    await profileSetupStepFactory.execute(ctx, PlayLevelService.playLevelStepName);
    sceneState.level = 'pro';
    expect(ctx.wizard.state.level).toBe('pro');
    expect(ctx.scene.state.level).toBe('pro');
  });
});
