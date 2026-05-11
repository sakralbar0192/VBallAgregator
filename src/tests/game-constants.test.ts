import { describe, it, expect } from '@jest/globals';
import {
  VENUE_IDS,
  getVenueName,
  getLevelName,
  getRegistrationStatusName,
  getPaymentStatusName,
  getGameStatusName,
  getAllVenues,
  getAllLevels,
  getOrganizerName,
} from '../shared/game-constants.js';

describe('game-constants', () => {
  it('maps ids to labels', () => {
    expect(getVenueName(VENUE_IDS.CHAIKA)).toContain('Чайка');
    expect(getLevelName('beginner')).toBeTruthy();
    expect(getRegistrationStatusName('confirmed')).toBeTruthy();
    expect(getPaymentStatusName('paid')).toBeTruthy();
    expect(getGameStatusName('open')).toBeTruthy();
    expect(getVenueName('unknown')).toBe('unknown');
    expect(getAllVenues().length).toBeGreaterThan(0);
    expect(getAllLevels().length).toBeGreaterThan(0);
    expect(getOrganizerName({ organizer: { user: { name: 'Ann' } } })).toContain('Ann');
    expect(getOrganizerName({})).toBe('');
  });
});
