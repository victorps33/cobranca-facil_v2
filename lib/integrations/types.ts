import type { ChargeStatus, ERPProvider } from "@prisma/client";

// ---------------------------------------------------------------------------
// Normalized types — the contract between ERPAdapter and sync engine
// ---------------------------------------------------------------------------

export interface ERPCustomer {
  erpId: string;
  name: string;
  doc: string;
  email: string;
  phone: string;
  razaoSocial?: string;
  cidade?: string;
  estado?: string;
}

export interface ERPCharge {
  erpId: string;
  customerErpId: string;
  description: string;
  amountCents: number;
  amountPaidCents: number;
  dueDate: Date;
  paidAt?: Date;
  status: ChargeStatus;
  formaPagamento?: string;
  statusRaw: string;
  invoiceNumber?: string;
  invoiceUrl?: string;
}

export interface ERPInvoice {
  erpId: string;
  number: string;
  status: "EMITIDA" | "CANCELADA" | "PENDENTE";
  pdfUrl?: string;
  issuedAt?: Date;
}

// ---------------------------------------------------------------------------
// Input types — for creating/updating records in the ERP
// ---------------------------------------------------------------------------

export interface CreateCustomerInput {
  name: string;
  doc: string;
  email: string;
  phone: string;
  razaoSocial?: string;
  cidade?: string;
  estado?: string;
}

export type UpdateCustomerInput = Partial<CreateCustomerInput>;

export interface CreateChargeInput {
  customerErpId: string;
  description: string;
  amountCents: number;
  dueDate: Date;
  formaPagamento?: string;
}

export interface CreateInvoiceInput {
  customerErpId: string;
  amountCents: number;
  description: string;
  serviceCode?: string;
}

// ---------------------------------------------------------------------------
// Webhook event type (optional — ERPs without webhooks skip this)
// ---------------------------------------------------------------------------

export interface ERPWebhookEvent {
  type: "customer" | "charge";
  action: "created" | "updated" | "deleted";
  erpId: string;
  payload: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// ERPAdapter interface — the core abstraction
// ---------------------------------------------------------------------------

export interface ERPAdapter {
  readonly provider: ERPProvider;

  // Auth
  authenticate(): Promise<void>;

  // Customers
  listCustomers(since?: Date): Promise<ERPCustomer[]>;
  getCustomer(erpId: string): Promise<ERPCustomer | null>;
  createCustomer(data: CreateCustomerInput): Promise<ERPCustomer>;
  updateCustomer(erpId: string, data: UpdateCustomerInput): Promise<ERPCustomer>;

  // Charges
  listCharges(since?: Date): Promise<ERPCharge[]>;
  getCharge(erpId: string): Promise<ERPCharge | null>;
  createCharge(data: CreateChargeInput): Promise<ERPCharge>;
  updateChargeStatus(erpId: string, status: ChargeStatus): Promise<void>;

  // Invoices
  createInvoice(chargeId: string, data: CreateInvoiceInput): Promise<ERPInvoice>;
  getInvoice(erpId: string): Promise<ERPInvoice | null>;

  // Webhook (optional — Conta Azul doesn't support)
  parseWebhook?(payload: unknown): ERPWebhookEvent;
}

// ---------------------------------------------------------------------------
// Sync result type
// ---------------------------------------------------------------------------

export interface SyncResult {
  customersCreated: number;
  customersUpdated: number;
  customersErrors: number;
  chargesCreated: number;
  chargesUpdated: number;
  chargesErrors: number;
  errorDetails: string[];
}
