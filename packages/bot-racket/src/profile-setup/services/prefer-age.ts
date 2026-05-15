import { Markup } from 'telegraf';
import type { PreferredAge, PreferredAgeAction, PreferredAgeStepName } from '../types.js';
import type { EntityInfo } from '../step-wizard-types.js';
import turnDataIntoAction from '../utils/turn-data-into-action.js';
import { TENNIS_PROFILE_WIZARD_BACK_CB, TennisStepAction } from '../tennis-callbacks.js';
import { TennisText } from '../tennis-text.js';

export default class PreferredAgeService {
  static PreferredAgeStepName: PreferredAgeStepName = 'preferred-age';

  static preferredAges: Record<Exclude<PreferredAge, 'all'>, EntityInfo> = {
    'before-twenty': { name: 'до двадцати', shortName: '< 20' },
    'after-twenty-before-thirty': { name: 'от двадцати до тридцати', shortName: '20 – 30' },
    'after-thirty': { name: 'после тридцати', shortName: '30 <' },
  };

  static get preferredAgeKeys() {
    return Object.keys(PreferredAgeService.preferredAges) as PreferredAge[];
  }

  static getAgesKeyboard(selectedAges: PreferredAge[] = []) {
    const keyboardStructure: Exclude<PreferredAge, 'all'>[][] = [
      ['before-twenty', 'after-twenty-before-thirty', 'after-thirty'],
    ];

    function createTimeButton(preferredAge: Exclude<PreferredAge, 'all'>): [string, PreferredAgeAction] {
      const label = `${selectedAges.includes(preferredAge) ? '✅' : ''} ${PreferredAgeService.preferredAges[preferredAge].shortName}`;
      return [label, turnDataIntoAction(preferredAge, PreferredAgeService.PreferredAgeStepName) as PreferredAgeAction];
    }

    const agesKeyboard = keyboardStructure.map(row =>
      row.map(timeKey => Markup.button.callback(...createTimeButton(timeKey))),
    );

    agesKeyboard.push([
      Markup.button.callback(
        !selectedAges?.length ||
          PreferredAgeService.preferredAgeKeys.every(key => selectedAges?.includes(key))
          ? TennisText.anyAge
          : TennisText.ageDone,
        TennisStepAction.preferredAgeDone,
      ),
    ]);
    agesKeyboard.push([Markup.button.callback(TennisText.back, TENNIS_PROFILE_WIZARD_BACK_CB)]);
    return agesKeyboard;
  }

  static isPreferredAgeValid(preferredAge: string) {
    return PreferredAgeService.preferredAgeKeys.includes(preferredAge as PreferredAge);
  }

  static getReadablePreferredAgeInfo(preferredAges: (PreferredAge | 'all')[]) {
    if (preferredAges.includes('all')) return 'Любой';
    return preferredAges
      .filter((age): age is Exclude<PreferredAge, 'all'> => age !== 'all')
      .map(age => PreferredAgeService.preferredAges[age].name)
      .join(' и ');
  }
}
