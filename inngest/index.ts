export { inngest } from "./client";

import { updateRiskScore } from "./functions/update-risk-score";
import { logInteraction } from "./functions/log-interaction";
import { handleEscalation } from "./functions/handle-escalation";
import { handleDeliveryStatus } from "./functions/handle-delivery-status";
import { notifyPaymentReceived } from "./functions/notify-payment-received";
import { logAgentDecision } from "./functions/log-agent-decision";
import { dispatchOnSend } from "./functions/dispatch-on-send";

export const allFunctions = [
  updateRiskScore,
  logInteraction,
  handleEscalation,
  handleDeliveryStatus,
  notifyPaymentReceived,
  logAgentDecision,
  dispatchOnSend,
];
