import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { prisma } from '../infrastructure/prisma.js';
import { clearDatabase } from './test-db-helpers.js';
import {
  persistVolleyballProfile,
  loadVolleyballDraftFromDb,
} from '../../../bot-volley/src/bot/registration/volleyball-onboarding-state.js';
import type { OnboardingSessionData } from '../../../bot-volley/src/bot/registration/onboarding-session.js';
import type { DayTime, WeekDay } from '../../../bot-racket/src/profile-setup/types.js';

function buildVolleyballSession(): OnboardingSessionData {
  return {
    vbFormats: { classic: true, beach: false },
    vbLevelKey: 'amateur',
    vbWeekDays: ['monday', 'wednesday'],
    vbDayTimes: {
      monday: ['ten-am', 'eleven-am'],
      wednesday: [],
    } as Record<WeekDay, DayTime[]>,
    vbWantOrganize: false,
  };
}

describe('volleyball-onboarding-persist (integration)', () => {
  beforeEach(async () => {
    await clearDatabase();
  });

  afterEach(async () => {
    await clearDatabase();
  });

  it('persistVolleyballProfile writes profile, schedule and sport row', async () => {
    const user = await prisma.user.create({
      data: { telegramId: BigInt(710_001), name: 'VB Persist' },
    });
    await persistVolleyballProfile(user.id, buildVolleyballSession());

    const profile = await prisma.matchingProfile.findUnique({
      where: { userId_sport: { userId: user.id, sport: 'volleyball' } },
    });
    expect(profile?.playLevelCode).toBe('amateur');

    const schedule = await prisma.matchingSchedule.findUnique({
      where: { userId_sport: { userId: user.id, sport: 'volleyball' } },
    });
    expect(schedule?.monday).toBe('ten-am, eleven-am');
    expect(schedule?.wednesday).toBeNull();
    expect(schedule?.tuesday).toBeNull();

    const sp = await prisma.userSportProfile.findUnique({
      where: { userId_sport: { userId: user.id, sport: 'volleyball' } },
    });
    expect(sp?.volleyballFormats).toBe('classic');
    expect(sp?.wantsOrganizeVolleyball).toBe(false);
  });
});

describe('volleyball-onboarding-load (integration)', () => {
  beforeEach(async () => {
    await clearDatabase();
  });

  afterEach(async () => {
    await clearDatabase();
  });

  it('loadVolleyballDraftFromDb round-trips after persist', async () => {
    const user = await prisma.user.create({
      data: { telegramId: BigInt(710_002), name: 'VB Load' },
    });
    const source = buildVolleyballSession();
    source.vbWantOrganize = true;
    await persistVolleyballProfile(user.id, source);

    const loaded: OnboardingSessionData = {};
    await loadVolleyballDraftFromDb(user.id, loaded);

    expect(loaded.vbFormats).toEqual({ classic: true, beach: false });
    expect(loaded.vbLevelKey).toBe('amateur');
    expect(loaded.vbWeekDays).toEqual(['monday']);
    expect(loaded.vbDayTimes?.monday).toEqual(['ten-am', 'eleven-am']);
    expect(loaded.vbWantOrganize).toBe(true);
  });
});
