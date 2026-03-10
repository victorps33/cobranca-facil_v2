-- CreateEnum
CREATE TYPE "RiskProfile" AS ENUM ('BOM_PAGADOR', 'DUVIDOSO', 'MAU_PAGADOR');

-- CreateEnum
CREATE TYPE "DunningPhase" AS ENUM ('LEMBRETE', 'VENCIMENTO', 'ATRASO', 'NEGATIVACAO', 'COBRANCA_INTENSIVA', 'PROTESTO', 'POS_PROTESTO');

-- CreateEnum
CREATE TYPE "EscalationType" AS ENUM ('NEGATIVACAO', 'PROTESTO', 'JURIDICO');

-- CreateEnum
CREATE TYPE "EscalationStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "Channel" ADD VALUE 'LIGACAO';
ALTER TYPE "Channel" ADD VALUE 'BOA_VISTA';
ALTER TYPE "Channel" ADD VALUE 'CARTORIO';
ALTER TYPE "Channel" ADD VALUE 'JURIDICO';

-- AlterTable
ALTER TABLE "DunningRule" ADD COLUMN     "maxPhase" "DunningPhase" NOT NULL DEFAULT 'ATRASO',
ADD COLUMN     "riskProfile" "RiskProfile" NOT NULL DEFAULT 'BOM_PAGADOR';

-- AlterTable
ALTER TABLE "DunningStep" ADD COLUMN     "phase" "DunningPhase" NOT NULL DEFAULT 'LEMBRETE';

-- CreateTable
CREATE TABLE "FranchiseeRiskScore" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "defaultRate" DOUBLE PRECISION NOT NULL,
    "avgDaysLate" DOUBLE PRECISION NOT NULL,
    "totalOutstanding" INTEGER NOT NULL,
    "riskProfile" "RiskProfile" NOT NULL,
    "calculatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FranchiseeRiskScore_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EscalationTask" (
    "id" TEXT NOT NULL,
    "chargeId" TEXT NOT NULL,
    "type" "EscalationType" NOT NULL,
    "status" "EscalationStatus" NOT NULL DEFAULT 'PENDING',
    "description" TEXT NOT NULL,
    "resolvedAt" TIMESTAMP(3),
    "resolvedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EscalationTask_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FranchiseeRiskScore_customerId_key" ON "FranchiseeRiskScore"("customerId");

-- AddForeignKey
ALTER TABLE "FranchiseeRiskScore" ADD CONSTRAINT "FranchiseeRiskScore_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EscalationTask" ADD CONSTRAINT "EscalationTask_chargeId_fkey" FOREIGN KEY ("chargeId") REFERENCES "Charge"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

