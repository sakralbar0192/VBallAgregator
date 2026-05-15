/**
 * Публичный фасад онбординга для `RegistrationModule` и тестов.
 * Логика — в `OnboardingFlowController`, `SportsPickerController`, `VolleyballWizardController`.
 */
import type { Context } from 'telegraf';
import { LoggerFactory } from '../../../../core/src/shared/layer-logger.js';
import { BaseHandler } from '../common/base-handler.js';
import type { CatalogSport, DemoGender, VolleyballFormatKey } from './onboarding-constants.js';
export type { CatalogSport } from './onboarding-constants.js';
export { CATALOG_SPORTS } from './onboarding-constants.js';
import { OnboardingFlowController } from './onboarding-flow-controller.js';
import { SportsPickerController } from './sports-picker-controller.js';
import { VolleyballWizardController } from './volleyball-wizard-controller.js';

const log = LoggerFactory.bot('onboarding-handlers');

export class OnboardingHandlers extends BaseHandler {
  protected static override logger = log;

  static registerTennisBridge = OnboardingFlowController.registerTennisBridge;
  static handleStart = OnboardingFlowController.handleStart;
  static startNextSport = OnboardingFlowController.startNextSport;
  static finishVolleyballData = OnboardingFlowController.finishVolleyballData;
  static finishVolleyballAfterOrganizers = OnboardingFlowController.finishVolleyballAfterOrganizers;
  static buildOnboardingGamesDiscoveryBody = OnboardingFlowController.buildOnboardingGamesDiscoveryBody;
  static advanceQueue = OnboardingFlowController.advanceQueue;
  static finalizeSession = OnboardingFlowController.finalizeSession;
  static afterTennisProfileSaved = OnboardingFlowController.afterTennisProfileSaved;
  static handleReturningPick = OnboardingFlowController.handleReturningPick;
  static loadVolleyballForEdit = OnboardingFlowController.loadVolleyballForEdit;

  static sportPickKeyboard = SportsPickerController.sportPickKeyboard;
  static returningFullKeyboard = SportsPickerController.returningFullKeyboard;
  static returningPartialKeyboard = SportsPickerController.returningPartialKeyboard;
  static handleToggleVolleyball = SportsPickerController.handleToggleVolleyball;
  static handleToggleTennis = SportsPickerController.handleToggleTennis;
  static handleSportsDone = SportsPickerController.handleSportsDone;
  static handleDemoGender = (ctx: Context, gender: DemoGender) =>
    SportsPickerController.handleDemoGender(ctx, gender);
  static handleDemoAge = SportsPickerController.handleDemoAge;
  static handlePartialEdit = SportsPickerController.handlePartialEdit;
  static handlePartialAdd = SportsPickerController.handlePartialAdd;

  static vbFormatToggle = (ctx: Context, key: VolleyballFormatKey) =>
    VolleyballWizardController.vbFormatToggle(ctx, key);
  static vbFormatsDone = VolleyballWizardController.vbFormatsDone;
  static vbWizardBack = VolleyballWizardController.vbWizardBack;
  static vbLevel = VolleyballWizardController.vbLevel;
  static vbWeekToggle = VolleyballWizardController.vbWeekToggle;
  static vbPromptTimeForCursor = VolleyballWizardController.vbPromptTimeForCursor;
  static vbTimeToggle = VolleyballWizardController.vbTimeToggle;
  static vbAfterAllTimes = VolleyballWizardController.vbAfterAllTimes;
  static vbOrganize = VolleyballWizardController.vbOrganize;
}
