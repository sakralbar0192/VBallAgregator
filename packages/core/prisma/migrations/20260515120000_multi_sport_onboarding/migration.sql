-- Rename racket -> tennis (PostgreSQL 10+)
ALTER TYPE "SportKind" RENAME VALUE 'racket' TO 'tennis';

-- User demographics
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "gender" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "ageBand" TEXT;

-- MatchingProfile: composite PK with sport
ALTER TABLE "matching_profiles" ADD COLUMN "sport" "SportKind" NOT NULL DEFAULT 'tennis';
ALTER TABLE "matching_profiles" DROP CONSTRAINT "matching_profiles_pkey";
ALTER TABLE "matching_profiles" ADD CONSTRAINT "matching_profiles_pkey" PRIMARY KEY ("userId", "sport");

-- MatchingSchedule: composite PK with sport
ALTER TABLE "matching_schedules" ADD COLUMN "sport" "SportKind" NOT NULL DEFAULT 'tennis';
ALTER TABLE "matching_schedules" DROP CONSTRAINT "matching_schedules_pkey";
ALTER TABLE "matching_schedules" ADD CONSTRAINT "matching_schedules_pkey" PRIMARY KEY ("userId", "sport");

-- Per-sport profile (volleyball flags + level mirror; tennis row optional marker)
CREATE TABLE "user_sport_profiles" (
    "userId" TEXT NOT NULL,
    "sport" "SportKind" NOT NULL,
    "volleyballSkillTag" TEXT,
    "volleyballFormats" TEXT,
    "wantsOrganizeVolleyball" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_sport_profiles_pkey" PRIMARY KEY ("userId","sport"),
    CONSTRAINT "user_sport_profiles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "user_sport_profiles_userId_idx" ON "user_sport_profiles"("userId");
