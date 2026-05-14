-- CreateEnum
CREATE TYPE "PlayerOrganizerStatus" AS ENUM ('pending', 'confirmed', 'rejected');

-- CreateEnum
CREATE TYPE "GamePlayerResponseType" AS ENUM ('yes', 'no', 'ignored');

-- AlterTable
ALTER TABLE "games" ADD COLUMN     "priorityWindowClosesAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "player_organizers" (
    "id" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "organizerId" TEXT NOT NULL,
    "status" "PlayerOrganizerStatus" NOT NULL DEFAULT 'pending',
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "confirmedAt" TIMESTAMP(3),

    CONSTRAINT "player_organizers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "game_player_responses" (
    "id" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "response" "GamePlayerResponseType" NOT NULL,
    "respondedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "game_player_responses_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "player_organizers_organizerId_status_idx" ON "player_organizers"("organizerId", "status");

-- CreateIndex
CREATE INDEX "player_organizers_playerId_status_idx" ON "player_organizers"("playerId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "player_organizers_playerId_organizerId_key" ON "player_organizers"("playerId", "organizerId");

-- CreateIndex
CREATE INDEX "game_player_responses_gameId_response_idx" ON "game_player_responses"("gameId", "response");

-- CreateIndex
CREATE UNIQUE INDEX "game_player_responses_gameId_playerId_key" ON "game_player_responses"("gameId", "playerId");

-- CreateIndex
CREATE INDEX "user_notification_preferences_globalNotifications_idx" ON "user_notification_preferences"("globalNotifications");

-- AddForeignKey
ALTER TABLE "player_organizers" ADD CONSTRAINT "player_organizers_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "player_organizers" ADD CONSTRAINT "player_organizers_organizerId_fkey" FOREIGN KEY ("organizerId") REFERENCES "organizers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "game_player_responses" ADD CONSTRAINT "game_player_responses_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "games"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "game_player_responses" ADD CONSTRAINT "game_player_responses_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
