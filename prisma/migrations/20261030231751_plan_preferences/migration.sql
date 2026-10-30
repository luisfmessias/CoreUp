-- AlterTable
ALTER TABLE "User" ADD COLUMN     "preferences" JSONB;

-- AlterTable
ALTER TABLE "Workout" ADD COLUMN     "durationMin" INTEGER,
ADD COLUMN     "intensity" TEXT;
