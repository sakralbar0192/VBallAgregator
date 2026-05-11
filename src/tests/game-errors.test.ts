import { describe, it, expect } from '@jest/globals';
import { ERROR_CODES } from '../domain/errors.js';
import {
  GameNotOpenError,
  GameAlreadyStartedError,
  CapacityReachedError,
  AlreadyRegisteredError,
} from '../domain/errors/game-errors.js';

describe('game-errors', () => {
  it('constructs typed errors', () => {
    const d = new Date();
    expect(new GameNotOpenError('g1').code).toBe(ERROR_CODES.GAME_NOT_OPEN);
    expect(new GameAlreadyStartedError('g2', d).context).toMatchObject({ gameId: 'g2' });
    expect(new CapacityReachedError('g3', 10, 10).context).toMatchObject({ capacity: 10 });
    expect(new AlreadyRegisteredError('g4', 'u4').context).toMatchObject({ userId: 'u4' });
  });
});
