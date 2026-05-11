import { describe, it, expect } from '@jest/globals';
import { CallbackDataParser } from '../bot/common/callback-parser.js';

describe('CallbackDataParser', () => {
  it('parses game, player, organizer, level', () => {
    expect(CallbackDataParser.parseGameId('join_game_u1')).toBe('u1');
    expect(CallbackDataParser.parseGameId('x')).toBeNull();
    expect(CallbackDataParser.parsePlayerId('confirm_player_pid')).toBe('pid');
    expect(CallbackDataParser.parsePlayerId('reject_player_pid')).toBe('pid');
    expect(CallbackDataParser.parseOrganizerId('toggle_organizer_oid')).toBe('oid');
    expect(CallbackDataParser.parseLevel('level_pro')).toBe('pro');
  });

  it('parses wizard callbacks', () => {
    expect(CallbackDataParser.parseWizardDate('wizard_date_tomorrow')).toBe('tomorrow');
    expect(CallbackDataParser.parseWizardTime('wizard_time_14')).toBe(14);
    expect(CallbackDataParser.parseWizardLevel('wizard_level_novice')).toBe('novice');
    expect(CallbackDataParser.parseWizardVenue('wizard_venue_key')).toBe('key');
    expect(CallbackDataParser.parseWizardCapacity('wizard_capacity_12')).toBe(12);
    expect(CallbackDataParser.parseWizardPrice('wizard_price_125')).toBe('125');
  });

  it('parses payment and game action callbacks', () => {
    expect(CallbackDataParser.parseRemindPaymentsGameId('remind_payments_g1')).toBe('g1');
    expect(CallbackDataParser.parseCloseGameId('close_game_g1')).toBe('g1');
    expect(CallbackDataParser.parseLeaveGameId('leave_game_g1')).toBe('g1');
    expect(CallbackDataParser.parsePayGameId('pay_game_g1')).toBe('g1');
    expect(CallbackDataParser.parsePaymentsGameId('payments_game_g1')).toBe('g1');
  });

  it('parses respond_game', () => {
    expect(CallbackDataParser.parseRespondGame('respond_game_uuid_yes')).toEqual({
      gameId: 'uuid',
      response: 'yes',
    });
    expect(CallbackDataParser.parseRespondGame('respond_game_bad')).toBeNull();
  });
});
