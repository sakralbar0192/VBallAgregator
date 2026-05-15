import { describe, it, expect } from '@jest/globals';
import type { ProfileSetupWizardContext } from './types.js';
import {
  beginDayTimeWalk,
  getSelectedDaysOrdered,
  nextDayInWalk,
  pruneDayTimesForSelection,
  resolveDayTimeCursor,
} from './day-time-walk.js';

function ctxWithState(state: Record<string, unknown>): ProfileSetupWizardContext {
  return { wizard: { state } } as ProfileSetupWizardContext;
}

describe('day-time-walk', () => {
  it('orders selected days and walks monday → wednesday', () => {
    const ctx = ctxWithState({
      selectedDays: ['wednesday', 'monday'],
      dayTimes: { monday: ['ten-am'], wednesday: [] },
    });
    const ordered = getSelectedDaysOrdered(ctx);
    expect(ordered).toEqual(['monday', 'wednesday']);

    expect(beginDayTimeWalk(ctx, ordered)).toBe('monday');
    expect(resolveDayTimeCursor(ctx, ordered)).toBe('monday');

    ctx.wizard.state.dayTimeCursorDay = 'monday';
    expect(nextDayInWalk(ordered, 'monday')).toBe('wednesday');
    expect(nextDayInWalk(ordered, 'wednesday')).toBeUndefined();
  });

  it('prunes dayTimes for deselected days', () => {
    const ctx = ctxWithState({
      selectedDays: ['monday'],
      dayTimes: { monday: ['ten-am'], friday: ['twenty-pm'] },
    });
    pruneDayTimesForSelection(ctx, ['monday']);
    expect(ctx.wizard.state.dayTimes).toEqual({ monday: ['ten-am'] });
  });
});
