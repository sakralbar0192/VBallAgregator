import type { WizardContext, WizardContextWizard } from 'telegraf/scenes';

export type PlayLevel = 'beginner' | 'amateur' | 'pro';
export type PlayLevelStepName = 'play-level';
export type PlayLevelAction = `${PlayLevelStepName}_${PlayLevel}`;

export type PlayerAge = 'before-twenty' | 'after-twenty-before-thirty' | 'after-thirty';
export type PlayerAgeStepName = 'player-age';
export type PlayerAgeAction = `${PlayerAgeStepName}_${PlayerAge}`;

export type PlayerGender = 'men' | 'women';
export type PlayerGenderStepName = 'player-gender';
export type PlayerGenderAction = `${PlayerGenderStepName}_${PlayerGender}`;

export type WeekDay =
  | 'monday'
  | 'tuesday'
  | 'wednesday'
  | 'thursday'
  | 'friday'
  | 'saturday'
  | 'sunday';
export type WeekDayStepName = 'week-day';
export type WeekDayAction = `${WeekDayStepName}_${WeekDay}` | `${WeekDayStepName}_done`;

export type DayTime =
  | 'nine-am'
  | 'ten-am'
  | 'eleven-am'
  | 'twelve-am'
  | 'thirteen-pm'
  | 'fourteen-pm'
  | 'fifteen-pm'
  | 'sixteen-pm'
  | 'seventeen-pm'
  | 'eighteen-pm'
  | 'nineteen-pm'
  | 'twenty-pm';
export type DayTimeStepName = 'day-time';
export type DayTimeAction = `${DayTimeStepName}_${DayTime}` | `${DayTimeStepName}_done`;

export type PreferredAge = PlayerAge | 'all';
export type PreferredAgeStepName = 'preferred-age';
export type PreferredAgeAction = `${PreferredAgeStepName}_${PreferredAge}` | `${PreferredAgeStepName}_done`;

export type PreferredGender = PlayerGender | 'all';
export type PreferredGenderStepName = 'preferred-gender';
export type PreferredGenderAction =
  | `${PreferredGenderStepName}_${PreferredGender}`
  | `${PreferredGenderStepName}_done`;

export interface WizardState {
  level?: PlayLevel;
  age?: PlayerAge;
  gender?: PlayerGender;
  selectedDays?: WeekDay[];
  dayTimes?: Record<WeekDay, DayTime[]>;
  /** Текущий день при выборе времён (без состояния на инстансе шага — корректно при параллельных пользователях). */
  dayTimeCursorDay?: WeekDay;
  preferAges?: PreferredAge[];
  preferGenders?: PreferredGender[];
}

export interface ProfileSetupWizardContext extends WizardContext {
  wizard: WizardContextWizard<ProfileSetupWizardContext> & {
    state: WizardState;
  };
}

export type ProfileSetupActions =
  | PlayLevelAction
  | WeekDayAction
  | DayTimeAction
  | PreferredAgeAction
  | PreferredGenderAction;

export type StepKey =
  | PlayLevelStepName
  | WeekDayStepName
  | DayTimeStepName
  | PreferredAgeStepName
  | PreferredGenderStepName;
