// inngest/index.ts
export { inngest } from "./client";

// Reactive functions
import { updateRiskScore } from "./functions/update-risk-score";
import { logInteraction } from "./functions/log-interaction";
import { handleEscalation } from "./functions/handle-escalation";
import { handleDeliveryStatus } from "./functions/handle-delivery-status";
import { notifyPaymentReceived } from "./functions/notify-payment-received";
import { logAgentDecision } from "./functions/log-agent-decision";
import { dispatchOnSend } from "./functions/dispatch-on-send";
import {
  captureEngagementFromDelivery,
  captureEngagementFromRead,
  captureEngagementFromReply,
  captureEngagementFromPayment,
} from "./functions/capture-engagement";
import { erpPushSync } from "./functions/erp-push-sync";
import { erpCreateInvoice } from "./functions/erp-create-invoice";

// Batch communication engine
import { batchEvaluate } from "./functions/batch-evaluate";
import { batchGroup } from "./functions/batch-group";
import { batchSend } from "./functions/batch-send";
import { cancelIntentsOnPayment } from "./functions/cancel-intents-on-payment";

// Scheduled functions
import { recalculateRiskScores } from "./scheduled/recalculate-risk-scores";
import { refreshResolverStats } from "./scheduled/refresh-resolver-stats";
import { refreshCustomerProfiles } from "./scheduled/refresh-customer-profiles";
import { evaluateVariants } from "./scheduled/evaluate-variants";
import { erpPollSync } from "./scheduled/erp-poll-sync";
import { batchOrchestrator } from "./scheduled/batch-orchestrator";
import { batchFinalizer } from "./scheduled/batch-finalizer";

// Sagas (inbox + ERP only — dunning-saga removed)
import { chargeLifecycle } from "./sagas/charge-lifecycle";
import { inboundProcessing } from "./sagas/inbound-processing";
import { omieSync } from "./sagas/omie-sync";

export const allFunctions = [
  // Reactive
  updateRiskScore,
  logInteraction,
  handleEscalation,
  handleDeliveryStatus,
  notifyPaymentReceived,
  logAgentDecision,
  dispatchOnSend,
  captureEngagementFromDelivery,
  captureEngagementFromRead,
  captureEngagementFromReply,
  captureEngagementFromPayment,
  erpPushSync,
  erpCreateInvoice,
  cancelIntentsOnPayment,
  // Batch communication engine
  batchEvaluate,
  batchGroup,
  batchSend,
  // Scheduled
  batchOrchestrator,
  batchFinalizer,
  recalculateRiskScores,
  refreshResolverStats,
  refreshCustomerProfiles,
  evaluateVariants,
  erpPollSync,
  // Sagas
  chargeLifecycle,
  inboundProcessing,
  omieSync,
];
