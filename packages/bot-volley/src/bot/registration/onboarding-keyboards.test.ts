import { describe, it, expect } from '@jest/globals';
import { OnbCallback } from './onboarding-callbacks.js';
import { partialAddSportKeyboard, sportPickKeyboard } from './onboarding-keyboards.js';
import { filterOrderToMissingSports, toggleSportInOrder } from './sport-selection-state.js';
import type { OnboardingSessionData } from './onboarding-session.js';

describe('onboarding-keyboards', () => {
  it('sportPickKeyboard marks selected sports', () => {
    const kb = sportPickKeyboard(['volleyball']);
    expect(kb.inline_keyboard[0]![0]!.callback_data).toBe(OnbCallback.sportToggleVolleyball);
    expect(kb.inline_keyboard[0]![0]!.text).toContain('✅');
    expect(kb.inline_keyboard[1]![0]!.text).not.toContain('✅');
  });

  it('partialAddSportKeyboard only lists missing sports', () => {
    const kb = partialAddSportKeyboard(['tennis'], []);
    expect(kb.inline_keyboard).toHaveLength(2);
    expect(kb.inline_keyboard[0]![0]!.callback_data).toBe(OnbCallback.sportToggleTennis);
  });
});

describe('sport-selection-state', () => {
  it('toggleSportInOrder adds and removes', () => {
    const data: OnboardingSessionData = { sportPickOrder: [] };
    toggleSportInOrder(data, 'volleyball');
    expect(data.sportPickOrder).toEqual(['volleyball']);
    toggleSportInOrder(data, 'volleyball');
    expect(data.sportPickOrder).toEqual([]);
  });

  it('filterOrderToMissingSports keeps only missing', () => {
    const completed = new Set<'volleyball' | 'tennis'>(['volleyball']);
    const order = filterOrderToMissingSports(['volleyball', 'tennis'], completed);
    expect(order).toEqual(['tennis']);
  });
});
