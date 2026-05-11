import { describe, it, expect, jest } from '@jest/globals';
import { CommandValidator } from '../bot/common/command-validator.js';

describe('CommandValidator', () => {
  it('validateSingleArgCommand and multi', () => {
    const ctx = { message: { text: '/join abc-def' } } as any;
    expect(CommandValidator.validateSingleArgCommand(ctx, 'join')).toBe('abc-def');
    expect(CommandValidator.validateMultiArgCommand({ message: { text: '/x a b' } } as any)).toBe('a b');
    expect(CommandValidator.validateSingleArgCommand({ message: {} } as any, 'j')).toBeNull();
  });

  it('uuid helpers', () => {
    expect(CommandValidator.isValidUUID('not')).toBe(false);
    expect(CommandValidator.isValidUUID('550e8400-e29b-41d4-a716-446655440000')).toBe(true);
    expect(CommandValidator.validateGameId('550e8400-e29b-41d4-a716-446655440000')).toBeTruthy();
    expect(CommandValidator.validateGameId('bad')).toBeNull();
    expect(CommandValidator.createUsageMessage('join', '<id>')).toContain('/join');
  });

  it('validateAndExtractGameId', async () => {
    const reply = jest.fn(async () => {});
    const good = {
      message: { text: `/join 550e8400-e29b-41d4-a716-446655440000` },
      reply,
    } as any;
    await expect(CommandValidator.validateAndExtractGameId(good, 'join')).resolves.toBe(
      '550e8400-e29b-41d4-a716-446655440000'
    );

    const badUuid = { message: { text: '/join not-uuid' }, reply } as any;
    await expect(CommandValidator.validateAndExtractGameId(badUuid, 'join')).rejects.toThrow();
    expect(reply).toHaveBeenCalled();

    const noArg = { message: { text: '/join' }, reply } as any;
    await expect(CommandValidator.validateAndExtractGameId(noArg, 'join')).rejects.toThrow();
  });
});
