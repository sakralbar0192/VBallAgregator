import { describe, it, expect } from '@jest/globals';
import {
  beginPartialAdd,
  clearPartialAddMode,
  commitSportOrder,
  filterOrderToMissingSports,
  toggleSportInOrder,
} from './sport-selection-state.js';
import type { OnboardingSessionData } from './onboarding-session.js';

describe('sport-selection-state', () => {
  it('commitSportOrder sets queue and clears partial add', () => {
    const data: OnboardingSessionData = {
      partialAddMode: true,
      partialAddMissing: ['tennis'],
    };
    commitSportOrder(data, ['tennis']);
    expect(data.sportPickOrder).toEqual(['tennis']);
    expect(data.onboardingRemain).toEqual([]);
    expect(data.onboardingChosenSports).toEqual(['tennis']);
    expect(data.partialAddMode).toBeUndefined();
    expect(data.partialAddMissing).toBeUndefined();
  });

  it('beginPartialAdd resets order and sets missing list', () => {
    const data: OnboardingSessionData = { sportPickOrder: ['volleyball'] };
    beginPartialAdd(data, ['tennis']);
    expect(data.sportPickOrder).toEqual([]);
    expect(data.partialAddMode).toBe(true);
    expect(data.partialAddMissing).toEqual(['tennis']);
  });

  it('clearPartialAddMode removes flags only', () => {
    const data: OnboardingSessionData = {
      partialAddMode: true,
      partialAddMissing: ['tennis'],
      sportPickOrder: ['tennis'],
    };
    clearPartialAddMode(data);
    expect(data.partialAddMode).toBeUndefined();
    expect(data.sportPickOrder).toEqual(['tennis']);
  });
});
