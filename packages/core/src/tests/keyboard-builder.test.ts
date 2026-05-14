import { describe, it, expect } from '@jest/globals';
import type { InlineKeyboardButton } from 'telegraf/types';
import { KeyboardBuilder } from '../../../bot-volley/src/bot/common/keyboard-builder.js';

function callbackData(btn: InlineKeyboardButton): string | undefined {
  return 'callback_data' in btn ? btn.callback_data : undefined;
}

describe('KeyboardBuilder', () => {
  const gid = '00000000-0000-4000-8000-000000000001';

  it('createGameActionKeyboard builds rows', () => {
    const k = KeyboardBuilder.createGameActionKeyboard(gid, {
      canJoin: true,
      canLeave: true,
      canPay: true,
      canClose: true,
      canViewPayments: true,
    });
    expect(k.length).toBeGreaterThan(0);
    expect(JSON.stringify(k)).toContain('join_game_');
  });

  it('createSettingsKeyboard', () => {
    const k = KeyboardBuilder.createSettingsKeyboard({
      globalNotifications: true,
      paymentRemindersAuto: false,
      paymentRemindersManual: true,
      gameReminders24h: true,
      gameReminders2h: false,
      organizerNotifications: true,
    });
    expect(callbackData(k[0]![0]!)).toBe('toggle_global');
  });

  it('createOrganizerSelectionKeyboard', () => {
    const k = KeyboardBuilder.createOrganizerSelectionKeyboard(
      [{ id: 'o1', title: 'T', user: { name: 'N' } }],
      new Set(['o1'])
    );
    expect(k.length).toBeGreaterThan(0);
  });

  it('role, level, registration keyboards', () => {
    expect(KeyboardBuilder.createLevelSelectionKeyboard().length).toBe(4);
    expect(KeyboardBuilder.createRoleSelectionKeyboard().length).toBe(2);
    expect(KeyboardBuilder.createRegistrationCompletionKeyboard(true).length).toBe(2);
    expect(KeyboardBuilder.createRegistrationCompletionKeyboard(false).length).toBe(1);
  });

  it('palettes', () => {
    expect(KeyboardBuilder.createMainCommandPalette({ isOrganizer: true, hasPlayerRegistrations: true }).length).toBeGreaterThan(1);
    expect(KeyboardBuilder.createQuickCommandPalette({ isOrganizer: false, hasPlayerRegistrations: false }).length).toBeGreaterThan(0);
  });

  it('invitation and management keyboards', () => {
    expect(callbackData(KeyboardBuilder.createInvitationResponseKeyboard(gid)[0]![0]!)).toContain(gid);
    expect(callbackData(KeyboardBuilder.createPlayerManagementKeyboard('pid')[0]![0]!)).toContain('confirm_player_');
    expect(callbackData(KeyboardBuilder.createPaymentReminderKeyboard(gid)[0]![0]!)).toContain('remind_payments_');
  });
});
