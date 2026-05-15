/** Callback_data и идентификаторы шагов мастера тенниса. */
export const TENNIS_SCENE_ID = 'tennis-profile' as const;

export const TENNIS_PROFILE_WIZARD_BACK_CB = 'tennis-wizard_back' as const;

export const TennisStepId = {
  playLevel: 'play-level',
  preferredGender: 'preferred-gender',
  preferredAge: 'preferred-age',
  weekDay: 'week-day',
  dayTime: 'day-time',
} as const;

export const TennisStepAction = {
  weekDayDone: 'week-day_done',
  dayTimeDone: 'day-time_done',
  preferredGenderDone: 'preferred-gender_done',
  preferredAgeDone: 'preferred-age_done',
} as const;
