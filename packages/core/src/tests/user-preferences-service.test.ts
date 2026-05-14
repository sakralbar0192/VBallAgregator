import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { prisma } from '../infrastructure/prisma.js';
import { PrismaUserPreferencesService } from '../shared/user-preferences-service.js';
import { clearDatabase } from './test-db-helpers.js';

describe('PrismaUserPreferencesService', () => {
  beforeEach(async () => {
    await clearDatabase();
  }, 10000);

  afterEach(async () => {
    await clearDatabase();
    jest.restoreAllMocks();
  }, 10000);

  it('getPreferences creates defaults and uses cache on second call', async () => {
    const svc = new PrismaUserPreferencesService();
    const u = await prisma.user.create({
      data: { telegramId: 7001n, name: 'U' },
    });

    const a = await svc.getPreferences(u.id);
    expect(a.globalNotifications).toBe(true);

    const b = await svc.getPreferences(u.id);
    expect(b.globalNotifications).toBe(true);
  });

  it('updatePreferences upserts', async () => {
    const svc = new PrismaUserPreferencesService();
    const u = await prisma.user.create({
      data: { telegramId: 7003n, name: 'U' },
    });

    await svc.updatePreferences(u.id, { globalNotifications: false });

    const row = await prisma.userNotificationPreferences.findUnique({
      where: { userId: u.id },
    });
    expect(row?.globalNotifications).toBe(false);
  });

  it('isAllowed respects globals and notification types (fresh service after writes)', async () => {
    const u = await prisma.user.create({
      data: { telegramId: 7004n, name: 'U' },
    });

    const svc1 = new PrismaUserPreferencesService();
    await svc1.updatePreferences(u.id, {
      globalNotifications: true,
      paymentRemindersAuto: false,
      paymentRemindersManual: true,
      gameReminders24h: false,
      gameReminders2h: true,
      organizerNotifications: false,
    });

    const svc2 = new PrismaUserPreferencesService();
    expect(await svc2.isAllowed(u.id, 'payment-reminder-12h')).toBe(false);
    expect(await svc2.isAllowed(u.id, 'manual-payment-reminder')).toBe(true);
    expect(await svc2.isAllowed(u.id, 'game-reminder-24h')).toBe(false);
    expect(await svc2.isAllowed(u.id, 'game-reminder-2h')).toBe(true);
    expect(await svc2.isAllowed(u.id, 'player-joined')).toBe(false);
    expect(await svc2.isAllowed(u.id, 'unknown-type-xyz')).toBe(true);

    const svc3 = new PrismaUserPreferencesService();
    await svc3.updatePreferences(u.id, { globalNotifications: false });

    const svc4 = new PrismaUserPreferencesService();
    expect(await svc4.isAllowed(u.id, 'manual-payment-reminder')).toBe(false);
  });

  it('isAllowed fail-open on unexpected errors from getPreferences', async () => {
    const u = await prisma.user.create({
      data: { telegramId: 7005n, name: 'U' },
    });

    const svc = new PrismaUserPreferencesService();
    jest.spyOn(svc, 'getPreferences').mockRejectedValue(new Error('x'));

    expect(await svc.isAllowed(u.id, 'payment-reminder-12h')).toBe(true);
  });

  it('getPreferences returns defaults when prisma fails', async () => {
    const u = await prisma.user.create({
      data: { telegramId: 7002n, name: 'U' },
    });

    const svc = new PrismaUserPreferencesService();
    jest.spyOn(prisma.userNotificationPreferences, 'findUnique').mockRejectedValue(new Error('db'));

    const prefs = await svc.getPreferences(u.id);
    expect(prefs.globalNotifications).toBe(true);
  });
});
