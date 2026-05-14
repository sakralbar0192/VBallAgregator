import type { EntityInfo } from '../step-wizard-types.js';
import type { PlayerGenderStepName, PlayerGender } from '../types.js';

export default class PlayerGenderService {
  static playerGenderStepName: PlayerGenderStepName = 'player-gender';

  static playerGenders: Record<PlayerGender, EntityInfo> = {
    women: {
      name: 'женщины',
      shortName: '♀️',
    },
    men: {
      name: 'мужчины',
      shortName: '♂️',
    },
  };

  static get defaultLevel() {
    return PlayerGenderService.playerGenderKeys[0];
  }

  static get playerGenderKeys() {
    return Object.keys(PlayerGenderService.playerGenders) as PlayerGender[];
  }

  static get playerGenderEntries() {
    return Object.entries(PlayerGenderService.playerGenders) as [PlayerGender, EntityInfo][];
  }

  static isLevelValid(level: string) {
    return PlayerGenderService.playerGenderKeys.includes(level as PlayerGender);
  }

  static getReadableLevelInfo(level: PlayerGender) {
    return PlayerGenderService.playerGenders[level];
  }
}
