import type {
  Channel,
  AgentAction,
  EscalationReason,
  MessageSender,
  ConversationStatus,
  MessageQueueStatus,
} from "@prisma/client";

export interface AIDecision {
  action: AgentAction;
  message: string;
  confidence: number;
  reasoning: string;
  escalationReason?: EscalationReason;
}

export interface CollectionContext {
  customer: {
    id: string;
    name: string;
    email: string;
    phone: string;
  };
  charge: {
    id: string;
    description: string;
    amountCents: number;
    dueDate: Date;
    status: string;
    daysOverdue: number;
  };
  channel: Channel;
  recentMessages: {
    sender: MessageSender;
    content: string;
    createdAt: Date;
  }[];
  recentDecisions: {
    action: AgentAction;
    reasoning: string;
    createdAt: Date;
  }[];
  recentNotifications: {
    channel: Channel;
    status: string;
    sentAt: Date | null;
    renderedMessage: string;
  }[];
  openTasks: {
    title: string;
    status: string;
    priority: string;
  }[];
  healthStatus?: string;
  franqueadoraId: string;
}

export interface InboundContext {
  customer: {
    id: string;
    name: string;
    email: string;
    phone: string;
  };
  conversationId: string;
  channel: Channel;
  inboundMessage: string;
  recentMessages: {
    sender: MessageSender;
    content: string;
    createdAt: Date;
  }[];
  recentDecisions: {
    action: AgentAction;
    reasoning: string;
    createdAt: Date;
  }[];
  openCharges: {
    id: string;
    description: string;
    amountCents: number;
    dueDate: Date;
    status: string;
  }[];
  openTasks: {
    title: string;
    status: string;
    priority: string;
  }[];
  franqueadoraId: string;
}

export interface DispatchResult {
  success: boolean;
  providerMsgId?: string;
  error?: string;
}

export interface WorkingHours {
  start: number;
  end: number;
  timezone: string;
}
