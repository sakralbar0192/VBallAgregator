import { describe, it, expect } from '@jest/globals';
import {
  advanceVolleyballTimeCursor,
  beginVolleyballTimeWalk,
  buildVolleyballProfileCompletionMessage,
  emptyVolleyballFormats,
  hasAnyVolleyballFormat,
  resetVolleyballDraftForNewSport,
  toggleVolleyballWeekDay,
} from './volleyball-onboarding-state.js';
import type { OnboardingSessionData } from './onboarding-session.js';

describe('volleyball-onboarding-state', () => {
  it('resetVolleyballDraftForNewSport clears draft fields', () => {
    const data: OnboardingSessionData = {
      vbFormats: { classic: true, beach: true },
      vbWeekDays: ['monday'],
      vbLevelKey: 'pro',
      vbWantOrganize: true,
    };
    resetVolleyballDraftForNewSport(data);
    expect(data.vbFormats).toEqual(emptyVolleyballFormats());
    expect(data.vbWeekDays).toEqual([]);
    expect(data.vbLevelKey).toBeUndefined();
    expect(data.vbWantOrganize).toBeUndefined();
  });

  it('toggleVolleyballWeekDay removes day and times', () => {
    const data: OnboardingSessionData = {
      vbWeekDays: ['monday', 'tuesday'],
      vbDayTimes: { monday: ['ten-am'], tuesday: ['eleven-am'] } as OnboardingSessionData['vbDayTimes'],
    };
    toggleVolleyballWeekDay(data, 'monday');
    expect(data.vbWeekDays).toEqual(['tuesday']);
    expect(data.vbDayTimes?.monday).toBeUndefined();
  });

  it('buildVolleyballProfileCompletionMessage includes configured fields', () => {
    const data: OnboardingSessionData = {
      vbFormats: { classic: true, beach: false },
      vbLevelKey: 'amateur',
      vbWeekDays: ['monday'],
      vbDayTimes: { monday: ['ten-am'] } as OnboardingSessionData['vbDayTimes'],
      vbWantOrganize: false,
    };
    const msg = buildVolleyballProfileCompletionMessage(data);
    expect(msg).toContain('Профиль волейбола настроен');
    expect(msg).toContain('классика');
    expect(msg).toContain('Любитель');
    expect(msg).toContain('понедельник');
    expect(msg).toContain('нет');
  });

  it('beginVolleyballTimeWalk sets first day cursor', () => {
    const data: OnboardingSessionData = {
      vbWeekDays: ['wednesday', 'monday'],
    };
    beginVolleyballTimeWalk(data);
    expect(data.vbWeekDays).toEqual(['monday', 'wednesday']);
    expect(data.vbCursorDay).toBe('monday');
    expect(data.vbUiPhase).toBe('tm');
  });

  it('advanceVolleyballTimeCursor returns next day in order', () => {
    const data: OnboardingSessionData = {
      vbWeekDays: ['monday', 'wednesday'],
    };
    expect(advanceVolleyballTimeCursor(data, 'monday')).toBe('wednesday');
    expect(advanceVolleyballTimeCursor(data, 'wednesday')).toBeNull();
  });

  it('hasAnyVolleyballFormat requires at least one format', () => {
    expect(hasAnyVolleyballFormat({ vbFormats: { classic: true, beach: false } })).toBe(true);
    expect(hasAnyVolleyballFormat({ vbFormats: emptyVolleyballFormats() })).toBe(false);
  });
});
