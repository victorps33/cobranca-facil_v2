-- CreateEnum
CREATE TYPE "ERPProvider" AS ENUM ('OMIE', 'CONTA_AZUL', 'NONE');

-- AlterTable Customer: add updatedAt and generic ERP fields
ALTER TABLE "Customer" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN "erpProvider" "ERPProvider",
ADD COLUMN "erpCustomerId" TEXT,
ADD COLUMN "erpLastSyncAt" TIMESTAMP(3);

-- AlterTable Charge: add generic ERP and invoice fields
ALTER TABLE "Charge" ADD COLUMN "erpProvider" "ERPProvider",
ADD COLUMN "erpChargeId" TEXT,
ADD COLUMN "erpLastSyncAt" TIMESTAMP(3),
ADD COLUMN "invoiceNumber" TEXT,
ADD COLUMN "invoiceStatus" TEXT,
ADD COLUMN "invoicePdfUrl" TEXT,
ADD COLUMN "invoiceIssuedAt" TIMESTAMP(3);

-- CreateTable ERPConfig
CREATE TABLE "ERPConfig" (
    "id" TEXT NOT NULL,
    "franqueadoraId" TEXT NOT NULL,
    "provider" "ERPProvider" NOT NULL DEFAULT 'NONE',
    "omieAppKey" TEXT,
    "omieAppSecret" TEXT,
    "omieWebhookSecret" TEXT,
    "contaAzulClientId" TEXT,
    "contaAzulClientSecret" TEXT,
    "contaAzulAccessToken" TEXT,
    "contaAzulRefreshToken" TEXT,
    "contaAzulTokenExpiresAt" TIMESTAMP(3),
    "lastSyncAt" TIMESTAMP(3),
    "syncIntervalMin" INTEGER NOT NULL DEFAULT 10,
    "syncEnabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ERPConfig_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ERPConfig_franqueadoraId_key" ON "ERPConfig"("franqueadoraId");

-- CreateIndex
CREATE INDEX "Customer_erpProvider_erpCustomerId_idx" ON "Customer"("erpProvider", "erpCustomerId");

-- CreateIndex
CREATE INDEX "Charge_erpProvider_erpChargeId_idx" ON "Charge"("erpProvider", "erpChargeId");

-- AddForeignKey
ALTER TABLE "ERPConfig" ADD CONSTRAINT "ERPConfig_franqueadoraId_fkey" FOREIGN KEY ("franqueadoraId") REFERENCES "Franqueadora"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
