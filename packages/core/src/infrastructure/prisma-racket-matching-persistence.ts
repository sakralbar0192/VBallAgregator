import type { PrismaClient } from '@prisma/client';
import type {
  RacketMatchingProfilePersistencePort,
  RacketMatchingProfileRow,
  RacketMatchingScheduleRow,
} from '../../../contracts/src/racket-matching-persistence.js';

export class PrismaRacketMatchingPersistence implements RacketMatchingProfilePersistencePort {
  constructor(private readonly db: PrismaClient) {}

  async upsertProfile(row: RacketMatchingProfileRow): Promise<void> {
    await this.db.matchingProfile.upsert({
      where: { userId: row.userId },
      create: {
        userId: row.userId,
        preferredGenders: row.preferredGenders,
        preferredAges: row.preferredAges,
        playLevel: row.playLevel,
        playLevelCode: row.playLevelCode,
        playerGender: row.playerGender,
        playerAgeBand: row.playerAgeBand,
        weekdayPreference: row.weekdayPreference,
        dayTimePreference: row.dayTimePreference,
      },
      update: {
        preferredGenders: row.preferredGenders,
        preferredAges: row.preferredAges,
        playLevel: row.playLevel,
        playLevelCode: row.playLevelCode,
        playerGender: row.playerGender,
        playerAgeBand: row.playerAgeBand,
        weekdayPreference: row.weekdayPreference,
        dayTimePreference: row.dayTimePreference,
      },
    });
  }

  async upsertSchedule(row: RacketMatchingScheduleRow): Promise<void> {
    await this.db.matchingSchedule.upsert({
      where: { userId: row.userId },
      create: {
        userId: row.userId,
        monday: row.monday,
        tuesday: row.tuesday,
        wednesday: row.wednesday,
        thursday: row.thursday,
        friday: row.friday,
        saturday: row.saturday,
        sunday: row.sunday,
      },
      update: {
        monday: row.monday,
        tuesday: row.tuesday,
        wednesday: row.wednesday,
        thursday: row.thursday,
        friday: row.friday,
        saturday: row.saturday,
        sunday: row.sunday,
      },
    });
  }
}
