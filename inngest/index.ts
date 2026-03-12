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

// Scheduled functions
import { checkPendingCharges } from "./scheduled/check-pending-charges";
import { recalculateRiskScores } from "./scheduled/recalculate-risk-scores";
import { refreshResolverStats } from "./scheduled/refresh-resolver-stats";
import { refreshCustomerProfiles } from "./scheduled/refresh-customer-profiles";
import { evaluateVariants } from "./scheduled/evaluate-variants";
import { erpPollSync } from "./scheduled/erp-poll-sync";

import { erpPushSync } from "./functions/erp-push-sync";
import { erpCreateInvoice } from "./functions/erp-create-invoice";

// Sagas
import { chargeLifecycle } from "./sagas/charge-lifecycle";
import { dunningSaga } from "./sagas/dunning-saga";
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
  // Scheduled
  checkPendingCharges,
  recalculateRiskScores,
  refreshResolverStats,
  refreshCustomerProfiles,
  evaluateVariants,
  erpPollSync,
  // Sagas
  chargeLifecycle,
  dunningSaga,
  inboundProcessing,
  omieSync,
];
