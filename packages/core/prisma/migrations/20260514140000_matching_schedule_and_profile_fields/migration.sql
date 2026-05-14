-- AlterTable matching_profiles
ALTER TABLE "matching_profiles" ADD COLUMN "playLevelCode" TEXT,
ADD COLUMN "playerGender" TEXT,
ADD COLUMN "playerAgeBand" TEXT;

-- CreateTable
CREATE TABLE "matching_schedules" (
    "userId" TEXT NOT NULL,
    "monday" TEXT,
    "tuesday" TEXT,
    "wednesday" TEXT,
    "thursday" TEXT,
    "friday" TEXT,
    "saturday" TEXT,
    "sunday" TEXT,

    CONSTRAINT "matching_schedules_pkey" PRIMARY KEY ("userId")
);

-- AddForeignKey
ALTER TABLE "matching_schedules" ADD CONSTRAINT "matching_schedules_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
