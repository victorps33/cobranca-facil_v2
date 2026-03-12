import type { ERPConfig } from "@prisma/client";
import type {
  ERPAdapter,
  ERPCustomer,
  ERPCharge,
  ERPInvoice,
  CreateCustomerInput,
  UpdateCustomerInput,
  CreateChargeInput,
  CreateInvoiceInput,
} from "../types";
import type { ChargeStatus } from "@prisma/client";
import { ContaAzulClient } from "./client";
import { mapContaAzulStatus } from "./status-mapper";
import type {
  ContaAzulCustomer,
  ContaAzulReceivable,
  ContaAzulServiceInvoice,
} from "./types";

// ---------------------------------------------------------------------------
// ContaAzulAdapter — implements ERPAdapter for Conta Azul ERP
// ---------------------------------------------------------------------------

export class ContaAzulAdapter implements ERPAdapter {
  readonly provider = "CONTA_AZUL" as const;
  private client: ContaAzulClient;

  constructor(erpConfig: ERPConfig) {
    this.client = new ContaAzulClient(erpConfig);
  }

  async authenticate(): Promise<void> {
    // OAuth2 tokens are managed by the client automatically
    // This call validates the token is usable
    await this.client.get("/customers?page_size=1");
  }

  // ── Customers ──

  async listCustomers(since?: Date): Promise<ERPCustomer[]> {
    const params: Record<string, string> = { page_size: "200" };
    if (since) {
      params.updated_since = since.toISOString();
    }
    const customers = await this.client.getAllPages<ContaAzulCustomer>(
      "/customers",
      params
    );
    return customers.map(this.mapCustomer);
  }

  async getCustomer(erpId: string): Promise<ERPCustomer | null> {
    try {
      const customer = await this.client.get<ContaAzulCustomer>(
        `/customers/${erpId}`
      );
      return this.mapCustomer(customer);
    } catch {
      return null;
    }
  }

  async createCustomer(data: CreateCustomerInput): Promise<ERPCustomer> {
    const body = {
      name: data.name,
      company_name: data.razaoSocial || data.name,
      document: data.doc,
      email: data.email,
      mobile_phone: data.phone,
      person_type: data.doc.length > 11 ? "LEGAL" : "NATURAL",
      address: {
        city: data.cidade ? { name: data.cidade } : undefined,
        state: data.estado ? { abbreviation: data.estado } : undefined,
      },
    };
    const created = await this.client.post<ContaAzulCustomer>("/customers", body);
    return this.mapCustomer(created);
  }

  async updateCustomer(
    erpId: string,
    data: UpdateCustomerInput
  ): Promise<ERPCustomer> {
    const body: Record<string, unknown> = {};
    if (data.name) body.name = data.name;
    if (data.doc) body.document = data.doc;
    if (data.email) body.email = data.email;
    if (data.phone) body.mobile_phone = data.phone;
    if (data.razaoSocial) body.company_name = data.razaoSocial;

    const updated = await this.client.put<ContaAzulCustomer>(
      `/customers/${erpId}`,
      body
    );
    return this.mapCustomer(updated);
  }

  // ── Charges (Receivables) ──

  async listCharges(since?: Date): Promise<ERPCharge[]> {
    const params: Record<string, string> = { page_size: "200" };
    if (since) {
      params.updated_since = since.toISOString();
    }
    const receivables = await this.client.getAllPages<ContaAzulReceivable>(
      "/receivables",
      params
    );
    return receivables.map(this.mapCharge);
  }

  async getCharge(erpId: string): Promise<ERPCharge | null> {
    try {
      const receivable = await this.client.get<ContaAzulReceivable>(
        `/receivables/${erpId}`
      );
      return this.mapCharge(receivable);
    } catch {
      return null;
    }
  }

  async createCharge(data: CreateChargeInput): Promise<ERPCharge> {
    const body = {
      customer_id: data.customerErpId,
      description: data.description,
      value: data.amountCents / 100,
      due_date: data.dueDate.toISOString().split("T")[0],
    };
    const created = await this.client.post<ContaAzulReceivable>(
      "/receivables",
      body
    );
    return this.mapCharge(created);
  }

  async updateChargeStatus(erpId: string, status: ChargeStatus): Promise<void> {
    // Conta Azul uses specific endpoints for status changes
    if (status === "CANCELED") {
      await this.client.put(`/receivables/${erpId}`, { status: "CANCELLED" });
    }
    // Other status transitions happen through payment recording
  }

  // ── Invoices ──

  async createInvoice(
    _chargeId: string,
    data: CreateInvoiceInput
  ): Promise<ERPInvoice> {
    const body = {
      customer_id: data.customerErpId,
      service_value: data.amountCents / 100,
      description: data.description,
      service_code: data.serviceCode || undefined,
    };
    const invoice = await this.client.post<ContaAzulServiceInvoice>(
      "/services/invoices",
      body
    );
    return this.mapInvoice(invoice);
  }

  async getInvoice(erpId: string): Promise<ERPInvoice | null> {
    try {
      const invoice = await this.client.get<ContaAzulServiceInvoice>(
        `/services/invoices/${erpId}`
      );
      return this.mapInvoice(invoice);
    } catch {
      return null;
    }
  }

  // ── Mappers (private) ──

  private mapCustomer(c: ContaAzulCustomer): ERPCustomer {
    return {
      erpId: c.id,
      name: c.name || c.company_name || "",
      doc: c.document || "",
      email: c.email || "",
      phone: c.mobile_phone || c.business_phone || "",
      razaoSocial: c.company_name || undefined,
      cidade: c.address?.city?.name || undefined,
      estado: c.address?.state?.abbreviation || undefined,
    };
  }

  private mapCharge(r: ContaAzulReceivable): ERPCharge {
    return {
      erpId: r.id,
      customerErpId: r.customer_id,
      description: r.description || r.document_number || "",
      amountCents: Math.round((r.value || 0) * 100),
      amountPaidCents: Math.round((r.paid_value || 0) * 100),
      dueDate: new Date(r.due_date),
      paidAt: r.payment_date ? new Date(r.payment_date) : undefined,
      status: mapContaAzulStatus(r.status),
      statusRaw: r.status,
    };
  }

  private mapInvoice(i: ContaAzulServiceInvoice): ERPInvoice {
    const statusMap: Record<string, ERPInvoice["status"]> = {
      ISSUED: "EMITIDA",
      CANCELLED: "CANCELADA",
      CANCELED: "CANCELADA",
      PENDING: "PENDENTE",
      ERROR: "PENDENTE",
    };
    return {
      erpId: i.protocol_id || i.id,
      number: i.number || "",
      status: statusMap[i.status?.toUpperCase()] || "PENDENTE",
      pdfUrl: i.pdf_url || undefined,
      issuedAt: i.issue_date ? new Date(i.issue_date) : undefined,
    };
  }
}
