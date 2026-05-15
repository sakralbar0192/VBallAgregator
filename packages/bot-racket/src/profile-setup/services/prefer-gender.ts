import { Markup } from 'telegraf';
import type { PreferredGender, PreferredGenderAction, PreferredGenderStepName } from '../types.js';
import type { EntityInfo } from '../step-wizard-types.js';
import turnDataIntoAction from '../utils/turn-data-into-action.js';
import { TENNIS_PROFILE_WIZARD_BACK_CB, TennisStepAction } from '../tennis-callbacks.js';
import { TennisText } from '../tennis-text.js';

export default class PreferredGenderService {
  static PreferredGenderStepName: PreferredGenderStepName = 'preferred-gender';

  static preferredGenders: Record<Exclude<PreferredGender, 'all'>, EntityInfo> = {
    women: { name: 'женщины', shortName: '♀️' },
    men: { name: 'мужчины', shortName: '♂️' },
  };

  static get preferredGenderKeys() {
    return Object.keys(PreferredGenderService.preferredGenders) as PreferredGender[];
  }

  static getGendersKeyboard(selectedGenders: PreferredGender[] = []) {
    const keyboardStructure: Exclude<PreferredGender, 'all'>[][] = [['women', 'men']];

    function createTimeButton(preferredGender: Exclude<PreferredGender, 'all'>): [string, PreferredGenderAction] {
      const label = `${selectedGenders.includes(preferredGender) ? '✅' : ''} ${PreferredGenderService.preferredGenders[preferredGender].shortName}`;
      return [
        label,
        turnDataIntoAction(preferredGender, PreferredGenderService.PreferredGenderStepName) as PreferredGenderAction,
      ];
    }

    const gendersKeyboard = keyboardStructure.map(row =>
      row.map(gender => Markup.button.callback(...createTimeButton(gender))),
    );

    gendersKeyboard.push([
      Markup.button.callback(
        !selectedGenders?.length ||
          PreferredGenderService.preferredGenderKeys.every(key => selectedGenders?.includes(key))
          ? TennisText.anyGender
          : TennisText.genderDone,
        TennisStepAction.preferredGenderDone,
      ),
    ]);
    gendersKeyboard.push([Markup.button.callback(TennisText.back, TENNIS_PROFILE_WIZARD_BACK_CB)]);
    return gendersKeyboard;
  }

  static isPreferredGenderValid(preferredGender: string) {
    return PreferredGenderService.preferredGenderKeys.includes(preferredGender as PreferredGender);
  }

  static getReadablePreferredGenderInfo(preferredGenders: PreferredGender[]) {
    if (preferredGenders.includes('all')) return 'любой';
    return preferredGenders
      .filter((gender): gender is Exclude<PreferredGender, 'all'> => gender !== 'all')
      .map(gender => PreferredGenderService.preferredGenders[gender].name)
      .join(' и ');
  }
}
