export { inngest } from "./client";

// Reactive functions
import { updateRiskScore } from "./functions/update-risk-score";
import { logInteraction } from "./functions/log-interaction";
import { handleEscalation } from "./functions/handle-escalation";
import { handleDeliveryStatus } from "./functions/handle-delivery-status";
import { notifyPaymentReceived } from "./functions/notify-payment-received";
import { logAgentDecision } from "./functions/log-agent-decision";
import { dispatchOnSend } from "./functions/dispatch-on-send";

// Scheduled functions
import { checkPendingCharges } from "./scheduled/check-pending-charges";
import { recalculateRiskScores } from "./scheduled/recalculate-risk-scores";

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
  // Scheduled
  checkPendingCharges,
  recalculateRiskScores,
  // Sagas
  chargeLifecycle,
  dunningSaga,
  inboundProcessing,
  omieSync,
];
