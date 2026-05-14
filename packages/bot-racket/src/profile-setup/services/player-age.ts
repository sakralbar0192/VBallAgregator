import type { EntityInfo } from '../step-wizard-types.js';
import type { PlayerAgeStepName, PlayerAge } from '../types.js';

export default class PlayerAgeService {
  static playerAgeStepName: PlayerAgeStepName = 'player-age';

  static playerAges: Record<PlayerAge, EntityInfo> = {
    'before-twenty': {
      name: 'до двадцати',
      shortName: '< 20',
    },
    'after-twenty-before-thirty': {
      name: 'от двадцати до тридцати',
      shortName: '20 – 30',
    },
    'after-thirty': {
      name: 'после тридцати',
      shortName: '30 <',
    },
  };

  static get defaultLevel() {
    return PlayerAgeService.playerAgeKeys[0];
  }

  static get playerAgeKeys() {
    return Object.keys(PlayerAgeService.playerAges) as PlayerAge[];
  }

  static get playerAgeEntries() {
    return Object.entries(PlayerAgeService.playerAges) as [PlayerAge, EntityInfo][];
  }

  static isLevelValid(level: string) {
    return PlayerAgeService.playerAgeKeys.includes(level as PlayerAge);
  }

  static getReadableLevelInfo(level: PlayerAge) {
    return PlayerAgeService.playerAges[level];
  }
}
