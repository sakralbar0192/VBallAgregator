import type { CatalogSport } from './onboarding-constants.js';
import { CATALOG_SPORTS } from './onboarding-constants.js';
import type { OnboardingSessionData } from './onboarding-session.js';
import { partialAddSportKeyboard, sportPickKeyboard } from './onboarding-keyboards.js';

export function toggleSportInOrder(data: OnboardingSessionData, sport: CatalogSport): void {
  data.sportPickOrder ??= [];
  const i = data.sportPickOrder.indexOf(sport);
  if (i >= 0) data.sportPickOrder.splice(i, 1);
  else data.sportPickOrder.push(sport);
}

export function sportPickReplyMarkup(data: OnboardingSessionData) {
  const order = data.sportPickOrder ?? [];
  if (data.partialAddMode && data.partialAddMissing?.length) {
    return partialAddSportKeyboard(data.partialAddMissing, order);
  }
  return sportPickKeyboard(order);
}

export function filterOrderToMissingSports(
  order: CatalogSport[],
  completed: Set<CatalogSport>,
): CatalogSport[] {
  const missing = CATALOG_SPORTS.filter(s => !completed.has(s));
  return order.filter((s): s is CatalogSport => missing.includes(s));
}

export function beginPartialAdd(data: OnboardingSessionData, missing: CatalogSport[]): void {
  data.sportPickOrder = [];
  data.partialAddMode = true;
  data.partialAddMissing = [...missing];
}

export function clearPartialAddMode(data: OnboardingSessionData): void {
  delete data.partialAddMode;
  delete data.partialAddMissing;
}

export function commitSportOrder(
  data: OnboardingSessionData,
  order: CatalogSport[],
): void {
  data.sportPickOrder = [...order];
  data.onboardingRemain = order.slice(1);
  data.onboardingChosenSports = [...order];
  clearPartialAddMode(data);
}
