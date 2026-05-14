-- CreateEnum
CREATE TYPE "SportKind" AS ENUM ('volleyball', 'racket');

-- AlterTable
ALTER TABLE "users" ADD COLUMN "activeSport" "SportKind" NOT NULL DEFAULT 'volleyball';

-- CreateTable
CREATE TABLE "matching_profiles" (
    "userId" TEXT NOT NULL,
    "preferredGenders" TEXT NOT NULL DEFAULT '',
    "preferredAges" TEXT NOT NULL DEFAULT '',
    "playLevel" TEXT NOT NULL DEFAULT '',
    "weekdayPreference" TEXT,
    "dayTimePreference" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "matching_profiles_pkey" PRIMARY KEY ("userId")
);

-- AddForeignKey
ALTER TABLE "matching_profiles" ADD CONSTRAINT "matching_profiles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
