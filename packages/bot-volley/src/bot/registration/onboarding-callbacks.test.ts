import { describe, it, expect } from '@jest/globals';
import { OnbCallback, OnbCallbackPattern } from './onboarding-callbacks.js';

describe('OnbCallback stability', () => {
  it('matches snapshot of callback_data strings', () => {
    expect(OnbCallback).toMatchInlineSnapshot(`
{
  "demoGenderMen": "onb_dg_men",
  "demoGenderWomen": "onb_dg_women",
  "partialAdd": "onb_rp_add",
  "partialEdit": "onb_rp_edit",
  "returningEditTennis": "onb_rf_tennis",
  "returningEditVolleyball": "onb_rf_volleyball",
  "selectOrganizersRegistration": "select_organizers_registration",
  "sportDone": "onb_t_done",
  "sportToggleTennis": "onb_t_tennis",
  "sportToggleVolleyball": "onb_t_volleyball",
  "vbFormatBeach": "onbVB_fmt_beach",
  "vbFormatClassic": "onbVB_fmt_classic",
  "vbFormatDone": "onbVB_fmt_done",
  "vbOrgNo": "onbVB_org_no",
  "vbOrgYes": "onbVB_org_yes",
  "vbWizardBack": "onbVB_back",
}
`);
  });

  it('vbWeekDay pattern accepts weekday tokens and done', () => {
    expect(OnbCallbackPattern.vbWeekDay.test('onbVB_wd_monday')).toBe(true);
    expect(OnbCallbackPattern.vbWeekDay.test('onbVB_wd_done')).toBe(true);
    expect(OnbCallbackPattern.vbWeekDay.test('onbVB_wd_invalid')).toBe(false);
  });
});
