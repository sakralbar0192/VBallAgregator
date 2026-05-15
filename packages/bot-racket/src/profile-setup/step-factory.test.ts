import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import type { WizardContext } from 'telegraf/scenes';
import { StepFactory } from './step-factory.js';

type DemoStep = 'alpha' | 'beta';
type DemoAction = 'alpha_go' | 'beta_go';

describe('StepFactory (racket profile-setup)', () => {
  it('advances to the next step when handleInput returns true', async () => {
    const ctx = {} as WizardContext;
    const factory = new StepFactory<DemoStep, DemoAction, WizardContext>({
      steps: [
        {
          name: 'alpha',
          step: {
            execute: async () => {},
            handleInput: async () => true,
          },
        },
        {
          name: 'beta',
          step: {
            execute: async () => {},
            handleInput: async () => true,
          },
        },
      ],
      defaultStep: 'alpha',
      finalizeFunction: async () => {},
    });

    const afterAlpha = await factory.handle(ctx, 'alpha_go');
    expect(afterAlpha).toBe('beta');

    const afterBeta = await factory.handle(ctx, 'beta_go');
    expect(afterBeta).toBeNull();
  });

  it('runs execute every time the scene requests a step (same-step refresh)', async () => {
    const ctx = {} as WizardContext;
    let alphaRuns = 0;
    const factory = new StepFactory<DemoStep, DemoAction, WizardContext>({
      steps: [
        {
          name: 'alpha',
          step: {
            execute: async () => {
              alphaRuns++;
            },
            handleInput: async () => false,
          },
        },
      ],
      defaultStep: 'alpha',
      finalizeFunction: async () => {},
    });

    await factory.execute(ctx, 'alpha');
    await factory.execute(ctx, 'alpha');
    expect(alphaRuns).toBe(2);
  });

  it('goBack rewinds to the previous step', async () => {
    const ctx = {} as WizardContext;
    const factory = new StepFactory<DemoStep, DemoAction, WizardContext>({
      steps: [
        {
          name: 'alpha',
          step: {
            execute: async () => {},
            handleInput: async () => true,
          },
        },
        {
          name: 'beta',
          step: {
            execute: async () => {},
            handleInput: async () => false,
          },
        },
      ],
      defaultStep: 'alpha',
      finalizeFunction: async () => {},
    });

    await factory.execute(ctx, 'alpha');
    const afterGo = await factory.handle(ctx, 'alpha_go');
    expect(afterGo).toBe('beta');
    await factory.execute(ctx, 'beta');

    expect(await factory.goBack(ctx)).toBe('rewound');
    expect(await factory.goBack(ctx)).toBe('at-first');
  });
});
