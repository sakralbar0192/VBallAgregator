import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { prisma } from '../infrastructure/prisma.js';
import { clearDatabase } from './test-db-helpers.js';
import { applyTennisWizardStateFromDb } from '../../../bot-racket/src/profile-setup/tennis-wizard-prefill.js';
import type { WizardState } from '../../../bot-racket/src/profile-setup/types.js';

describe('tennis-wizard-prefill (integration)', () => {
  beforeEach(async () => {
    await clearDatabase();
  });

  afterEach(async () => {
    await clearDatabase();
  });

  it('loads wizard state from persisted tennis profile and schedule', async () => {
    const telegramId = 720_001;
    const user = await prisma.user.create({
      data: {
        telegramId: BigInt(telegramId),
        name: 'Tennis Prefill',
        gender: 'women',
        ageBand: 'before-twenty',
      },
    });
    await prisma.matchingProfile.create({
      data: {
        userId: user.id,
        sport: 'tennis',
        preferredGenders: 'men',
        preferredAges: 'after-thirty',
        playLevel: 'любитель',
        playLevelCode: 'amateur',
      },
    });
    await prisma.matchingSchedule.create({
      data: {
        userId: user.id,
        sport: 'tennis',
        friday: '10:00',
        saturday: 'ten-am',
      },
    });

    const state = {} as WizardState;
    expect(await applyTennisWizardStateFromDb(state, telegramId)).toBe(true);
    expect(state.level).toBe('amateur');
    expect(state.preferGenders).toEqual(['men']);
    expect(state.preferAges).toEqual(['after-thirty']);
    expect(state.selectedDays).toEqual(['friday', 'saturday']);
    expect(state.dayTimes?.friday).toEqual(['ten-am']);
    expect(state.dayTimes?.saturday).toEqual(['ten-am']);
  });
});
