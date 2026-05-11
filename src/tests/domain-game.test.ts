import { describe, it, expect } from '@jest/globals';
import { Game, GameStatus } from '../domain/game.js';

describe('Game domain', () => {
  const future = new Date(Date.now() + 86400_000);
  const past = new Date(Date.now() - 3600_000);

  it('ensureCanJoin allows when open and future', () => {
    const g = new Game('i', 'o', 'v', future, 2, 'x', '100₽');
    g.ensureCanJoin(0);
    expect(() => g.ensureCanJoin(2)).toThrow();
  });

  it('ensureCanJoin rejects closed or started', () => {
    const g = new Game('i', 'o', 'v', future, 2);
    g.close();
    expect(() => g.ensureCanJoin(0)).toThrow();

    const started = new Game('i', 'o', 'v', past, 4);
    expect(() => started.ensureCanJoin(0)).toThrow();
  });

  it('payment window when game started', () => {
    const g = new Game('i', 'o', 'v', past, 4);
    expect(g.isPaymentWindowOpen).toBe(true);
    g.finish();
    expect(g.status).toBe(GameStatus.finished);
    expect(g.isPaymentWindowOpen).toBe(true);
  });

  it('cancel', () => {
    const g = new Game('i', 'o', 'v', future, 4);
    g.cancel();
    expect(g.status).toBe(GameStatus.canceled);
  });
});
