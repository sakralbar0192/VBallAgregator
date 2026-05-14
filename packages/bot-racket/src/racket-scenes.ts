import { Scenes } from 'telegraf';
import type { ProfileSetupWizardContext } from './profile-setup/types.js';
import { createRacketProfileWizardScene } from './profile-setup/profile-setup-scene.js';

export function getRacketScenes(): Scenes.BaseScene<ProfileSetupWizardContext>[] {
  return [createRacketProfileWizardScene()];
}
