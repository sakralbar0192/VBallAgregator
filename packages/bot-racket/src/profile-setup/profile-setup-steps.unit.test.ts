import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import type { ProfileSetupWizardContext } from './types.js';
import { WeekDayStep } from './steps/week-day.js';
import { DayTimeStep } from './steps/day-time.js';
import { TennisStepAction } from './tennis-callbacks.js';

function createWizardCtx(state: Record<string, unknown> = {}): ProfileSetupWizardContext {
  return {
    wizard: { state },
    answerCbQuery: jest.fn(async () => true),
    reply: jest.fn(),
    editMessageText: jest.fn(),
  } as unknown as ProfileSetupWizardContext;
}

describe('WeekDayStep', () => {
  let step: WeekDayStep;

  beforeEach(() => {
    step = new WeekDayStep();
    jest.spyOn(step, 'replyOrEdit').mockResolvedValue(undefined);
  });

  it('week-day_done without days does not advance', async () => {
    const ctx = createWizardCtx({ selectedDays: [] });
    const result = await step.handleInput(ctx, TennisStepAction.weekDayDone);
    expect(result).toBeUndefined();
    expect(ctx.answerCbQuery).toHaveBeenCalled();
  });

  it('deselecting day removes dayTimes entry', async () => {
    const ctx = createWizardCtx({
      selectedDays: ['monday'],
      dayTimes: { monday: ['ten-am'] },
    });
    await step.handleInput(ctx, 'week-day_monday' as never);
    expect(ctx.wizard.state.selectedDays).toEqual([]);
    expect(ctx.wizard.state.dayTimes).toEqual({});
  });

  it('week-day_done starts day-time walk on all selected days', async () => {
    const ctx = createWizardCtx({
      selectedDays: ['monday'],
      dayTimes: { monday: ['ten-am'] },
    });
    const result = await step.handleInput(ctx, TennisStepAction.weekDayDone);
    expect(result).toBe(true);
    expect(ctx.wizard.state.dayTimeCursorDay).toBe('monday');
  });
});

describe('DayTimeStep', () => {
  let step: DayTimeStep;

  beforeEach(() => {
    step = new DayTimeStep();
    jest.spyOn(step, 'replyOrEdit').mockResolvedValue(undefined);
  });

  it('day-time_done without slots does not advance', async () => {
    const ctx = createWizardCtx({
      selectedDays: ['monday'],
      dayTimes: { monday: [] },
      dayTimeCursorDay: 'monday',
    });
    const result = await step.handleInput(ctx, TennisStepAction.dayTimeDone);
    expect(result).toBeUndefined();
  });

  it('day-time_done advances cursor to next day when more days remain', async () => {
    const ctx = createWizardCtx({
      selectedDays: ['monday', 'wednesday'],
      dayTimes: { monday: ['ten-am'], wednesday: [] },
      dayTimeCursorDay: 'monday',
    });
    const result = await step.handleInput(ctx, TennisStepAction.dayTimeDone);
    expect(result).toBeUndefined();
    expect(ctx.wizard.state.dayTimeCursorDay).toBe('wednesday');
  });
});
