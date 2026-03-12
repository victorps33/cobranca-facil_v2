import type { ERPConfig } from "@prisma/client";
import type { ChargeStatus } from "@prisma/client";
import type {
  ERPAdapter,
  ERPCustomer,
  ERPCharge,
  ERPInvoice,
  ERPWebhookEvent,
  CreateCustomerInput,
  UpdateCustomerInput,
  CreateChargeInput,
  CreateInvoiceInput,
} from "../types";
import {
  omieRequest,
  omieRequestAllPages,
  fetchOmieCliente,
  fetchOmieTitulo,
} from "./client";
import { mapOmieStatus } from "./statusMapper";
import type { OmieCliente, OmieContaReceber, OmieWebhookPayload } from "./types";

// ---------------------------------------------------------------------------
// OmieAdapter — wraps existing Omie integration into ERPAdapter interface
// NOTE: Currently reads credentials from env vars for backward compatibility.
// The ERPConfig credentials are available but not yet used by the underlying client.
// ---------------------------------------------------------------------------

export class OmieAdapter implements ERPAdapter {
  readonly provider = "OMIE" as const;

  constructor(private config: ERPConfig) {
    // Config available for future multi-tenant Omie support
  }

  async authenticate(): Promise<void> {
    // Omie uses API key/secret in request body — validated on each call
    // Just verify credentials are available
    if (!process.env.OMIE_APP_KEY || !process.env.OMIE_APP_SECRET) {
      throw new Error("[OmieAdapter] OMIE_APP_KEY and OMIE_APP_SECRET must be set");
    }
  }

  // ── Customers ──

  async listCustomers(_since?: Date): Promise<ERPCustomer[]> {
    const clientes = await omieRequestAllPages<OmieCliente>(
      "/geral/clientes/",
      "ListarClientes",
      "clientes_cadastro",
      { clientesFiltro: { inativo: "N" } }
    );
    return clientes
      .filter((c) => c.codigo_cliente_integracao !== "_CLIENTE_CONSUMIDOR_")
      .map(this.mapCustomer);
  }

  async getCustomer(erpId: string): Promise<ERPCustomer | null> {
    try {
      const cli = await fetchOmieCliente(Number(erpId));
      return this.mapCustomer(cli);
    } catch {
      return null;
    }
  }

  async createCustomer(data: CreateCustomerInput): Promise<ERPCustomer> {
    const result = await omieRequest<{ codigo_cliente_omie: number }>(
      "/geral/clientes/",
      "IncluirCliente",
      {
        razao_social: data.razaoSocial || data.name,
        nome_fantasia: data.name,
        cnpj_cpf: data.doc,
        email: data.email,
        telefone1_numero: data.phone,
        cidade: data.cidade || "",
        estado: data.estado || "",
      }
    );
    const cli = await fetchOmieCliente(result.codigo_cliente_omie);
    return this.mapCustomer(cli);
  }

  async updateCustomer(
    erpId: string,
    data: UpdateCustomerInput
  ): Promise<ERPCustomer> {
    const params: Record<string, unknown> = {
      codigo_cliente_omie: Number(erpId),
    };
    if (data.name) params.nome_fantasia = data.name;
    if (data.razaoSocial) params.razao_social = data.razaoSocial;
    if (data.email) params.email = data.email;
    if (data.phone) params.telefone1_numero = data.phone;

    await omieRequest("/geral/clientes/", "AlterarCliente", params);
    const cli = await fetchOmieCliente(Number(erpId));
    return this.mapCustomer(cli);
  }

  // ── Charges ──

  async listCharges(_since?: Date): Promise<ERPCharge[]> {
    const titulos = await omieRequestAllPages<OmieContaReceber>(
      "/financas/contareceber/",
      "ListarContasReceber",
      "conta_receber_cadastro"
    );
    return titulos.map(this.mapCharge);
  }

  async getCharge(erpId: string): Promise<ERPCharge | null> {
    try {
      const titulo = await fetchOmieTitulo(Number(erpId));
      return this.mapCharge(titulo);
    } catch {
      return null;
    }
  }

  async createCharge(data: CreateChargeInput): Promise<ERPCharge> {
    const dueStr = `${data.dueDate.getDate().toString().padStart(2, "0")}/${(data.dueDate.getMonth() + 1).toString().padStart(2, "0")}/${data.dueDate.getFullYear()}`;
    const result = await omieRequest<{ codigo_lancamento_omie: number }>(
      "/financas/contareceber/",
      "IncluirContaReceber",
      {
        codigo_cliente_fornecedor: Number(data.customerErpId),
        data_vencimento: dueStr,
        valor_documento: data.amountCents / 100,
        numero_documento: data.description,
      }
    );
    const titulo = await fetchOmieTitulo(result.codigo_lancamento_omie);
    return this.mapCharge(titulo);
  }

  async updateChargeStatus(_erpId: string, _status: ChargeStatus): Promise<void> {
    // Omie status is managed internally — no direct status update API
    console.warn("[OmieAdapter] updateChargeStatus not supported by Omie API");
  }

  // ── Invoices ──

  async createInvoice(
    _chargeId: string,
    _data: CreateInvoiceInput
  ): Promise<ERPInvoice> {
    // TODO: Implement via Omie NFS-e API when needed
    throw new Error("[OmieAdapter] createInvoice not yet implemented");
  }

  async getInvoice(_erpId: string): Promise<ERPInvoice | null> {
    // TODO: Implement via Omie NFS-e API when needed
    return null;
  }

  // ── Webhook ──

  parseWebhook(payload: unknown): ERPWebhookEvent {
    const p = payload as OmieWebhookPayload;
    const topicLower = (p.topic || "").toLowerCase();

    if (topicLower.startsWith("financas.contareceber")) {
      return {
        type: "charge",
        action: "updated",
        erpId: String(p.event?.codigo_lancamento_omie || ""),
        payload: p.event as Record<string, unknown>,
      };
    }

    return {
      type: "customer",
      action: "updated",
      erpId: String(p.event?.codigo_cliente_omie || ""),
      payload: p.event as Record<string, unknown>,
    };
  }

  // ── Private mappers ──

  private mapCustomer(cli: OmieCliente): ERPCustomer {
    return {
      erpId: String(cli.codigo_cliente_omie),
      name: cli.nome_fantasia || cli.razao_social || "",
      doc: (cli.cnpj_cpf || "").replace(/\D/g, ""),
      email: cli.email || "",
      phone: cli.telefone1_numero || "",
      razaoSocial: cli.razao_social || undefined,
      cidade: cli.cidade || undefined,
      estado: cli.estado || undefined,
    };
  }

  private mapCharge(titulo: OmieContaReceber): ERPCharge {
    const parseDate = (s?: string) => {
      if (!s) return undefined;
      const [d, m, y] = s.split("/");
      const date = new Date(`${y}-${m}-${d}`);
      return isNaN(date.getTime()) ? undefined : date;
    };

    return {
      erpId: String(titulo.codigo_lancamento_omie),
      customerErpId: String(titulo.codigo_cliente_fornecedor),
      description: titulo.numero_documento || `Omie #${titulo.codigo_lancamento_omie}`,
      amountCents: Math.round((titulo.valor_documento || 0) * 100),
      amountPaidCents: Math.round((titulo.valor_pagamento || 0) * 100),
      dueDate: parseDate(titulo.data_vencimento) || new Date(),
      paidAt: parseDate(titulo.data_pagamento),
      status: mapOmieStatus(titulo.status_titulo || ""),
      statusRaw: titulo.status_titulo || "",
    };
  }
}
