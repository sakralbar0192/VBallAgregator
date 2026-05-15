import { sessionManager } from '../../../../core/src/shared/session-manager.js';
import type { DayTime, WeekDay } from '../../../../bot-racket/src/profile-setup/types.js';
import type { CatalogSport, VolleyballUiPhase } from './onboarding-constants.js';

/** Данные мультиспорт-онбординга в `sessionManager.data`. */
export type OnboardingSessionData = {
  onboardingChosenSports?: CatalogSport[];
  onboardingRemain?: CatalogSport[];
  onboardingEdit?: boolean;
  sportPickOrder?: CatalogSport[];
  vbUiPhase?: VolleyballUiPhase;
  vbFormats?: { classic: boolean; beach: boolean };
  vbLevelKey?: string;
  vbWeekDays?: WeekDay[];
  vbDayTimes?: Record<WeekDay, DayTime[]>;
  vbCursorDay?: WeekDay | null;
  vbWantOrganize?: boolean;
  onbAfterOrganizersContinue?: boolean;
  partialAddMode?: boolean;
  partialAddMissing?: CatalogSport[];
};

export function getOnboardingSession(): OnboardingSessionData {
  const s = sessionManager.getCurrentSession();
  if (!s) return {};
  s.data ??= {};
  return s.data as OnboardingSessionData;
}
