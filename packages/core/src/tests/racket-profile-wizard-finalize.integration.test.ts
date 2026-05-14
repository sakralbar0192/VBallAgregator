import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { prisma } from '../infrastructure/prisma.js';
import { clearDatabase } from './test-db-helpers.js';
import { persistRacketProfileFromWizardState } from '../../../bot-racket/src/profile-setup/profile-setup-persist.js';
import type { DayTime, WeekDay, WizardState } from '../../../bot-racket/src/profile-setup/types.js';

function buildWizardState(): WizardState {
  return {
    level: 'amateur',
    age: 'after-thirty',
    gender: 'men',
    selectedDays: ['monday', 'wednesday'],
    dayTimes: {
      monday: ['ten-am', 'eleven-am'],
      wednesday: ['twenty-pm'],
    } as Record<WeekDay, DayTime[]>,
    preferAges: ['before-twenty'],
    preferGenders: ['women'],
  };
}

describe('Racket profile wizard finalize (Prisma)', () => {
  beforeEach(async () => {
    await clearDatabase();
  });

  afterEach(async () => {
    await clearDatabase();
  });

  it('persists MatchingProfile and MatchingSchedule from wizard.state', async () => {
    const telegramId = 424242424;
    const user = await prisma.user.create({
      data: { telegramId: BigInt(telegramId), name: 'Racket Tester', activeSport: 'racket' },
    });

    await persistRacketProfileFromWizardState(telegramId, buildWizardState());

    const profile = await prisma.matchingProfile.findUnique({ where: { userId: user.id } });
    expect(profile).not.toBeNull();
    expect(profile?.playLevelCode).toBe('amateur');
    expect(profile?.playLevel).toBe('любитель');
    expect(profile?.playerGender).toBe('men');
    expect(profile?.playerAgeBand).toBe('after-thirty');
    expect(profile?.preferredAges).toBe('before-twenty');
    expect(profile?.preferredGenders).toBe('women');
    expect(profile?.weekdayPreference).toContain('понедельник');

    const schedule = await prisma.matchingSchedule.findUnique({ where: { userId: user.id } });
    expect(schedule?.monday).toBe('ten-am, eleven-am');
    expect(schedule?.wednesday).toBe('twenty-pm');
    expect(schedule?.tuesday).toBeNull();
  });
});
