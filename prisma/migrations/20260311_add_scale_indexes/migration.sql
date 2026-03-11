-- CreateIndex
CREATE INDEX "Charge_status_dueDate_idx" ON "Charge"("status", "dueDate");

-- CreateIndex
CREATE INDEX "Customer_phone_idx" ON "Customer"("phone");

-- CreateIndex
CREATE INDEX "Customer_whatsappPhone_idx" ON "Customer"("whatsappPhone");

-- CreateIndex
CREATE INDEX "DunningRule_franqueadoraId_riskProfile_active_idx" ON "DunningRule"("franqueadoraId", "riskProfile", "active");

-- CreateIndex
CREATE INDEX "EscalationTask_chargeId_idx" ON "EscalationTask"("chargeId");

-- CreateIndex
CREATE INDEX "EscalationTask_status_idx" ON "EscalationTask"("status");

-- CreateIndex
CREATE UNIQUE INDEX "NotificationLog_chargeId_stepId_key" ON "NotificationLog"("chargeId", "stepId");
