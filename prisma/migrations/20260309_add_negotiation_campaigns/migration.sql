-- CreateEnum
CREATE TYPE "CampaignStatus" AS ENUM ('DRAFT', 'ACTIVE', 'ENDED');

-- CreateTable
CREATE TABLE "NegotiationCampaign" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" "CampaignStatus" NOT NULL DEFAULT 'DRAFT',
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "maxCashDiscount" DOUBLE PRECISION NOT NULL DEFAULT 0.10,
    "maxInstallments" INTEGER NOT NULL DEFAULT 6,
    "monthlyInterestRate" DOUBLE PRECISION NOT NULL DEFAULT 0.02,
    "minInstallmentCents" INTEGER NOT NULL DEFAULT 5000,
    "targetFilters" JSONB,
    "franqueadoraId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NegotiationCampaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NegotiationCampaignStep" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "trigger" "DunningTrigger" NOT NULL,
    "offsetDays" INTEGER NOT NULL DEFAULT 0,
    "channel" "Channel" NOT NULL,
    "template" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NegotiationCampaignStep_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NegotiationCampaignCustomer" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NegotiationCampaignCustomer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "NegotiationCampaign_franqueadoraId_idx" ON "NegotiationCampaign"("franqueadoraId");

-- CreateIndex
CREATE INDEX "NegotiationCampaign_status_idx" ON "NegotiationCampaign"("status");

-- CreateIndex
CREATE INDEX "NegotiationCampaignStep_campaignId_idx" ON "NegotiationCampaignStep"("campaignId");

-- CreateIndex
CREATE INDEX "NegotiationCampaignCustomer_campaignId_idx" ON "NegotiationCampaignCustomer"("campaignId");

-- CreateIndex
CREATE INDEX "NegotiationCampaignCustomer_customerId_idx" ON "NegotiationCampaignCustomer"("customerId");

-- CreateIndex
CREATE UNIQUE INDEX "NegotiationCampaignCustomer_campaignId_customerId_key" ON "NegotiationCampaignCustomer"("campaignId", "customerId");

-- AddForeignKey
ALTER TABLE "NegotiationCampaign" ADD CONSTRAINT "NegotiationCampaign_franqueadoraId_fkey" FOREIGN KEY ("franqueadoraId") REFERENCES "Franqueadora"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NegotiationCampaignStep" ADD CONSTRAINT "NegotiationCampaignStep_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "NegotiationCampaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NegotiationCampaignCustomer" ADD CONSTRAINT "NegotiationCampaignCustomer_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "NegotiationCampaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NegotiationCampaignCustomer" ADD CONSTRAINT "NegotiationCampaignCustomer_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
