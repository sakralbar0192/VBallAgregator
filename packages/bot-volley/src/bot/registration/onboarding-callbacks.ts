import type { CatalogSport, DemoGender, VolleyballFormatKey } from './onboarding-constants.js';

/** Префиксы callback_data волейбольного мастера. */
export const VB_WD_PREFIX = 'onbVB_wd_' as const;
export const VB_TM_PREFIX = 'onbVB_tm_' as const;
export const VB_WIZARD_BACK = 'onbVB_back' as const;

export const OnbCallback = {
  sportToggleVolleyball: 'onb_t_volleyball',
  sportToggleTennis: 'onb_t_tennis',
  sportDone: 'onb_t_done',
  returningEditVolleyball: 'onb_rf_volleyball',
  returningEditTennis: 'onb_rf_tennis',
  partialEdit: 'onb_rp_edit',
  partialAdd: 'onb_rp_add',
  demoGenderMen: 'onb_dg_men',
  demoGenderWomen: 'onb_dg_women',
  vbFormatDone: 'onbVB_fmt_done',
  vbFormatClassic: 'onbVB_fmt_classic',
  vbFormatBeach: 'onbVB_fmt_beach',
  vbWizardBack: VB_WIZARD_BACK,
  vbOrgYes: 'onbVB_org_yes',
  vbOrgNo: 'onbVB_org_no',
  selectOrganizersRegistration: 'select_organizers_registration',
} as const;

export const OnbCallbackPattern = {
  demoAge: /^onb_da_(.+)$/,
  vbLevel: /^onbVB_lvl_(.+)$/,
  vbWeekDay: /^onbVB_wd_(monday|tuesday|wednesday|thursday|friday|saturday|sunday|done)$/,
  vbTime: /^onbVB_tm_(.+)$/,
  returningSport: /^onb_rf_(volleyball|tennis)$/,
  vbFormat: /^onbVB_fmt_(classic|beach)$/,
} as const;

export function vbWeekDayCallback(day: string): string {
  return `${VB_WD_PREFIX}${day}`;
}

export function vbWeekDayDoneCallback(): string {
  return `${VB_WD_PREFIX}done`;
}

export function vbTimeCallback(day: string, slot: string): string {
  return `${VB_TM_PREFIX}${day}_${slot}`;
}

export function vbTimeDoneCallback(day: string): string {
  return `${VB_TM_PREFIX}${day}_done`;
}

export function vbLevelCallback(levelKey: string): string {
  return `onbVB_lvl_${levelKey}`;
}

export function demoAgeCallback(ageBand: string): string {
  return `onb_da_${ageBand}`;
}

export function returningSportCallback(sport: CatalogSport): string {
  return `onb_rf_${sport}`;
}

export function vbFormatCallback(key: VolleyballFormatKey): string {
  return key === 'classic' ? OnbCallback.vbFormatClassic : OnbCallback.vbFormatBeach;
}

export function demoGenderCallback(gender: DemoGender): string {
  return gender === 'men' ? OnbCallback.demoGenderMen : OnbCallback.demoGenderWomen;
}
