-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('PROFESSIONAL_REQUEST_CREATED', 'PROFESSIONAL_REQUEST_APPROVED', 'PROFESSIONAL_REQUEST_REJECTED');

-- AlterEnum
ALTER TYPE "AccountType" ADD VALUE 'ADMIN';

-- AlterEnum: VERIFIED passa a se chamar APPROVED, preservando os registros.
ALTER TYPE "VerificationStatus" RENAME VALUE 'VERIFIED' TO 'APPROVED';

-- DropForeignKey
ALTER TABLE "ProfessionalProfile" DROP CONSTRAINT "ProfessionalProfile_userId_fkey";

-- DropIndex
DROP INDEX "ProfessionalProfile_crefNumber_crefState_key";

-- DropIndex
DROP INDEX "ProfessionalProfile_userId_key";

-- AlterTable: colunas novas entram vazias, sao preenchidas e so entao viram obrigatorias.
ALTER TABLE "ProfessionalProfile" ADD COLUMN     "crefKey" TEXT,
ADD COLUMN     "fullName" TEXT,
ADD COLUMN     "rejectionReason" TEXT,
ADD COLUMN     "reviewedAt" TIMESTAMP(3),
ADD COLUMN     "reviewedById" TEXT,
ALTER COLUMN "userId" DROP NOT NULL;

UPDATE "ProfessionalProfile" AS p
SET "fullName" = u."name"
FROM "User" AS u
WHERE u."id" = p."userId";

UPDATE "ProfessionalProfile"
SET "crefKey" = lpad(split_part("crefNumber", '-', 1), 6, '0') || '/' || "crefState";

ALTER TABLE "ProfessionalProfile" ALTER COLUMN "fullName" SET NOT NULL,
ALTER COLUMN "crefKey" SET NOT NULL;

-- Conta profissional so existe depois de aprovada: quem ainda nao foi aprovado volta a ser USER.
UPDATE "User" AS u
SET "accountType" = 'USER'
WHERE u."accountType" = 'PROFESSIONAL'
  AND NOT EXISTS (
    SELECT 1 FROM "ProfessionalProfile" AS p
    WHERE p."userId" = u."id" AND p."verificationStatus" = 'APPROVED'
  );

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "requestId" TEXT,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Notification_userId_createdAt_idx" ON "Notification"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ProfessionalProfile_crefKey_key" ON "ProfessionalProfile"("crefKey");

-- CreateIndex
CREATE INDEX "ProfessionalProfile_userId_idx" ON "ProfessionalProfile"("userId");

-- CreateIndex
CREATE INDEX "ProfessionalProfile_verificationStatus_createdAt_idx" ON "ProfessionalProfile"("verificationStatus", "createdAt");

-- AddForeignKey
ALTER TABLE "ProfessionalProfile" ADD CONSTRAINT "ProfessionalProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProfessionalProfile" ADD CONSTRAINT "ProfessionalProfile_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "ProfessionalProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
