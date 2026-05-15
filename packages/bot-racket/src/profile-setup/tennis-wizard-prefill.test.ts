import { describe, it, expect, jest, beforeEach } from '@jest/globals';

jest.unstable_mockModule('../../../core/src/infrastructure/prisma.js', () => ({
  prisma: {
    user: { findUnique: jest.fn() },
    matchingProfile: { findUnique: jest.fn() },
    matchingSchedule: { findUnique: jest.fn() },
  },
}));

const { prisma } = await import('../../../core/src/infrastructure/prisma.js');
const { applyTennisWizardStateFromDb } = await import('./tennis-wizard-prefill.js');
import type { WizardState } from './types.js';

describe('applyTennisWizardStateFromDb (unit)', () => {
  beforeEach(() => {
    jest.mocked(prisma.user.findUnique).mockReset();
    jest.mocked(prisma.matchingProfile.findUnique).mockReset();
    jest.mocked(prisma.matchingSchedule.findUnique).mockReset();
  });

  it('returns false when user missing', async () => {
    jest.mocked(prisma.user.findUnique).mockResolvedValue(null);
    const state = {} as WizardState;
    expect(await applyTennisWizardStateFromDb(state, 1)).toBe(false);
  });

  it('maps profile tokens and ten-am schedule keys', async () => {
    jest.mocked(prisma.user.findUnique).mockResolvedValue({ id: 'u1' } as never);
    jest.mocked(prisma.matchingProfile.findUnique).mockResolvedValue({
      preferredGenders: 'women',
      preferredAges: 'before-twenty',
      playLevelCode: 'amateur',
      playLevel: null,
    } as never);
    jest.mocked(prisma.matchingSchedule.findUnique).mockResolvedValue({
      monday: 'ten-am, eleven-am',
      wednesday: 'thirteen-pm',
    } as never);

    const state = {} as WizardState;
    expect(await applyTennisWizardStateFromDb(state, 1)).toBe(true);
    expect(state.level).toBe('amateur');
    expect(state.preferGenders).toEqual(['women']);
    expect(state.preferAges).toEqual(['before-twenty']);
    expect(state.selectedDays).toEqual(['monday', 'wednesday']);
    expect(state.dayTimes?.monday).toEqual(['ten-am', 'eleven-am']);
  });

  it('parses clock strings in schedule columns', async () => {
    jest.mocked(prisma.user.findUnique).mockResolvedValue({ id: 'u2' } as never);
    jest.mocked(prisma.matchingProfile.findUnique).mockResolvedValue(null);
    jest.mocked(prisma.matchingSchedule.findUnique).mockResolvedValue({
      tuesday: '10:00, 11:00',
    } as never);

    const state = {} as WizardState;
    expect(await applyTennisWizardStateFromDb(state, 2)).toBe(true);
    expect(state.selectedDays).toEqual(['tuesday']);
    expect(state.dayTimes?.tuesday).toEqual(['ten-am', 'eleven-am']);
  });
});
