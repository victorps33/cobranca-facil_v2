import type { ERPConfig } from "@prisma/client";
import type {
  ERPAdapter,
  ERPCustomer,
  ERPCharge,
  ERPBoleto,
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
  ContaAzulV2Paginated,
  ContaAzulV2Pessoa,
  ContaAzulV2Receivable,
  ContaAzulServiceInvoice,
  ContaAzulV1ParcelaDetail,
  ContaAzulV1Cobranca,
  ContaAzulPublicBoleto,
} from "./types";

// ---------------------------------------------------------------------------
// ContaAzulAdapter — implements ERPAdapter for Conta Azul ERP (API v2)
// Endpoints: /v1/pessoa, /v1/financeiro/eventos-financeiros/contas-a-receber
// ---------------------------------------------------------------------------

export class ContaAzulAdapter implements ERPAdapter {
  readonly provider = "CONTA_AZUL" as const;
  private client: ContaAzulClient;

  constructor(erpConfig: ERPConfig) {
    this.client = new ContaAzulClient(erpConfig);
  }

  async authenticate(): Promise<void> {
    await this.client.get("/pessoa?tamanho_pagina=1");
  }

  // ── Customers ──

  async listCustomers(_since?: Date): Promise<ERPCustomer[]> {
    const result = await this.client.get<ContaAzulV2Paginated<ContaAzulV2Pessoa>>(
      "/pessoa?tamanho_pagina=200&perfil=Cliente"
    );
    return result.itens.map(this.mapCustomer);
  }

  async getCustomer(erpId: string): Promise<ERPCustomer | null> {
    try {
      const result = await this.client.get<ContaAzulV2Pessoa>(
        `/pessoa/${erpId}`
      );
      return this.mapCustomer(result);
    } catch {
      return null;
    }
  }

  async createCustomer(data: CreateCustomerInput): Promise<ERPCustomer> {
    const body = {
      nome: data.name,
      documento: data.doc,
      email: data.email,
      telefone: data.phone,
      tipo_pessoa: data.doc.length > 11 ? "JURIDICA" : "FISICA",
      perfis: ["Cliente"],
    };
    const created = await this.client.post<ContaAzulV2Pessoa>("/pessoa", body);
    return this.mapCustomer(created);
  }

  async updateCustomer(
    erpId: string,
    data: UpdateCustomerInput
  ): Promise<ERPCustomer> {
    const body: Record<string, unknown> = {};
    if (data.name) body.nome = data.name;
    if (data.doc) body.documento = data.doc;
    if (data.email) body.email = data.email;
    if (data.phone) body.telefone = data.phone;

    const updated = await this.client.put<ContaAzulV2Pessoa>(
      `/pessoa/${erpId}`,
      body
    );
    return this.mapCustomer(updated);
  }

  // ── Charges (Receivables) ──

  async listCharges(since?: Date): Promise<ERPCharge[]> {
    // API v2 requires data_vencimento_de but we can't use `since` for it —
    // a receivable created AFTER lastSync can have a due date BEFORE it.
    // Always fetch a wide range and filter by data_alteracao client-side.
    const dateFrom = "2020-01-01";
    const dateTo = "2099-12-31";

    let allItems: ContaAzulV2Receivable[] = [];
    let pagina = 1;
    const tamanhoPagina = 200;

    // Paginate through all results
    while (true) {
      const result = await this.client.get<ContaAzulV2Paginated<ContaAzulV2Receivable>>(
        `/financeiro/eventos-financeiros/contas-a-receber/buscar?data_vencimento_de=${dateFrom}&data_vencimento_ate=${dateTo}&pagina=${pagina}&tamanho_pagina=${tamanhoPagina}`
      );
      allItems.push(...result.itens);

      if (result.itens.length < tamanhoPagina || allItems.length >= result.itens_totais) {
        break;
      }
      pagina++;
    }

    // Note: we intentionally do NOT filter by data_alteracao here.
    // The sync engine's upsert handles deduplication, and filtering by
    // timestamp causes race conditions (items created during sync get missed).
    // At scale (1000+ records), consider paginating by data_alteracao instead.

    return allItems.map(this.mapCharge);
  }

  async getCharge(erpId: string): Promise<ERPCharge | null> {
    try {
      const result = await this.client.get<ContaAzulV2Receivable>(
        `/financeiro/eventos-financeiros/contas-a-receber/${erpId}`
      );
      return this.mapCharge(result);
    } catch {
      return null;
    }
  }

  async createCharge(data: CreateChargeInput): Promise<ERPCharge> {
    const body = {
      cliente: { id: data.customerErpId },
      descricao: data.description,
      total: data.amountCents / 100,
      data_vencimento: data.dueDate.toISOString().split("T")[0],
    };
    const created = await this.client.post<ContaAzulV2Receivable>(
      "/financeiro/eventos-financeiros/contas-a-receber",
      body
    );
    return this.mapCharge(created);
  }

  async updateChargeStatus(erpId: string, status: ChargeStatus): Promise<void> {
    if (status === "CANCELED") {
      await this.client.put(
        `/financeiro/eventos-financeiros/contas-a-receber/${erpId}`,
        { status: "CANCELLED" }
      );
    }
  }

  // ── Boletos ──
  // Official v1 API flow:
  //   1. GET /parcelas/{id}           → solicitacoes_cobrancas
  //   2. GET /cobranca/{id_cobranca}  → url (boleto payment link)
  //   3. Public endpoint              → linha digitável, barcode

  async listBoletos(chargeErpIds: string[]): Promise<ERPBoleto[]> {
    const boletos: ERPBoleto[] = [];

    for (const parcelaId of chargeErpIds) {
      try {
        // Step 1: Get parcela details with charge requests
        const parcela = await this.client.get<ContaAzulV1ParcelaDetail>(
          `/financeiro/eventos-financeiros/parcelas/${parcelaId}`
        );

        if (!parcela.solicitacoes_cobrancas?.length) continue;

        // Step 2: Find boleto-type charge requests
        for (const sc of parcela.solicitacoes_cobrancas) {
          if (
            sc.tipo_solicitacao_cobranca !== "BOLETO" &&
            sc.tipo_solicitacao_cobranca !== "BOLETO_REGISTRADO"
          ) continue;

          // Step 3: Get charge details for URL
          const cobranca = await this.client.get<ContaAzulV1Cobranca>(
            `/financeiro/eventos-financeiros/contas-a-receber/cobranca/${sc.id}`
          );

          if (!cobranca.url) continue;

          // Step 4: Try to fetch boleto data from public endpoint
          const uuid = cobranca.url.match(/visualizar\/([a-f0-9-]+)/)?.[1];
          if (uuid) {
            try {
              const boletoData = await this.client.fetchExternalUrl<ContaAzulPublicBoleto>(
                `https://public.contaazul.com/payments/billing/charge/${uuid}/invoice`,
                false
              );
              boletos.push({
                chargeErpId: parcelaId,
                linhaDigitavel: boletoData.digitableLine || "",
                barcodeValue: (boletoData.barcode || "").replace(/[.\s]/g, ""),
                publicUrl: cobranca.url,
              });
            } catch {
              // Public endpoint failed — store URL without barcode data
              boletos.push({
                chargeErpId: parcelaId,
                linhaDigitavel: "",
                barcodeValue: "",
                publicUrl: cobranca.url,
              });
            }
          } else {
            // URL doesn't match expected pattern — store as-is
            boletos.push({
              chargeErpId: parcelaId,
              linhaDigitavel: "",
              barcodeValue: "",
              publicUrl: cobranca.url,
            });
          }

          break; // one boleto per parcela
        }
      } catch (err) {
        console.warn(
          `[Conta Azul] Failed to get boleto for parcela ${parcelaId}:`,
          err instanceof Error ? err.message : err
        );
      }
    }

    console.log(`[Conta Azul] Found ${boletos.length} boletos from ${chargeErpIds.length} parcelas`);
    return boletos;
  }

  // ── Invoices (still using old endpoints — may need update) ──

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

  private mapCustomer(c: ContaAzulV2Pessoa): ERPCustomer {
    return {
      erpId: c.uuid,
      name: c.nome || "",
      doc: c.documento || "",
      email: c.email || "",
      phone: c.telefone || "",
      razaoSocial: c.tipo_pessoa === "JURIDICA" ? c.nome : undefined,
    };
  }

  private mapCharge(r: ContaAzulV2Receivable): ERPCharge {
    return {
      erpId: r.id,
      customerErpId: r.cliente.id,
      description: r.descricao || "",
      amountCents: Math.round((r.total || 0) * 100),
      amountPaidCents: Math.round((r.pago || 0) * 100),
      dueDate: new Date(r.data_vencimento),
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
