/**
 * DTO для записи ракеточного matching-профиля (без зависимости от Telegraf / wizard types).
 */
export type RacketMatchingProfileRow = {
  userId: string;
  preferredGenders: string;
  preferredAges: string;
  playLevel: string;
  playLevelCode: string;
  playerGender: string | null;
  playerAgeBand: string | null;
  weekdayPreference: string;
  dayTimePreference: string;
};

export type RacketMatchingScheduleRow = {
  userId: string;
  monday: string | null;
  tuesday: string | null;
  wednesday: string | null;
  thursday: string | null;
  friday: string | null;
  saturday: string | null;
  sunday: string | null;
};

export interface RacketMatchingProfilePersistencePort {
  upsertProfile(row: RacketMatchingProfileRow): Promise<void>;
  upsertSchedule(row: RacketMatchingScheduleRow): Promise<void>;
}
