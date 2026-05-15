import { describe, it, expect } from '@jest/globals';
import { OnbText } from './onboarding-text.js';
import { OnboardingFlowController } from './onboarding-flow-controller.js';

describe('OnboardingFlowController', () => {
  it('buildOnboardingGamesDiscoveryBody lists configured sports', () => {
    const text = OnboardingFlowController.buildOnboardingGamesDiscoveryBody(['volleyball', 'tennis']);
    expect(text).toContain(OnbText.discoveryHeader);
    expect(text).toContain(OnbText.discoveryVolleyball);
    expect(text).toContain(OnbText.discoveryTennis);
  });

  it('buildOnboardingGamesDiscoveryBody deduplicates sports', () => {
    const text = OnboardingFlowController.buildOnboardingGamesDiscoveryBody([
      'volleyball',
      'volleyball',
      'tennis',
    ]);
    expect(text.split(OnbText.discoveryVolleyball).length - 1).toBe(1);
  });
});
