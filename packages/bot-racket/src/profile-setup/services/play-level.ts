import type { PlayLevel, PlayLevelStepName } from '../types.js';

export default class PlayLevelService {
  static playLevelStepName: PlayLevelStepName = 'play-level';

  static playLevels: Record<PlayLevel, string> = {
    beginner: 'новичок',
    amateur: 'любитель',
    pro: 'профессионал',
  };

  static get defaultLevel() {
    return PlayLevelService.playLevelKeys[0];
  }

  static get playLevelKeys() {
    return Object.keys(PlayLevelService.playLevels) as PlayLevel[];
  }

  static get playLevelEntries() {
    return Object.entries(PlayLevelService.playLevels) as [PlayLevel, string][];
  }

  static isLevelValid(level: string) {
    return PlayLevelService.playLevelKeys.includes(level as PlayLevel);
  }

  static getReadableLevelInfo(level: PlayLevel) {
    return PlayLevelService.playLevels[level];
  }
}
