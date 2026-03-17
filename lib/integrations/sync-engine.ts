import { prisma } from "@/lib/prisma";
import type { ERPProvider } from "@prisma/client";
import type { ERPAdapter, ERPCustomer, ERPCharge, ERPBoleto, SyncResult } from "./types";
import { getERPConfig } from "./erp-factory";

// ---------------------------------------------------------------------------
// Generic ERP sync engine — pulls data from ERP and upserts into local DB
// Uses the ERPAdapter interface so it works with any ERP.
// ---------------------------------------------------------------------------

export async function syncFranqueadora(
  franqueadoraId: string,
  adapter: ERPAdapter
): Promise<SyncResult> {
  const config = await getERPConfig(franqueadoraId);
  const since = config.lastSyncAt || undefined;
  const provider = adapter.provider;

  const result: SyncResult = {
    customersCreated: 0,
    customersUpdated: 0,
    customersErrors: 0,
    chargesCreated: 0,
    chargesUpdated: 0,
    chargesErrors: 0,
    boletosFound: 0,
    boletosErrors: 0,
    errorDetails: [],
  };

  // ── 1. Sync customers ──
  console.log(`[Sync Engine] Syncing customers for ${franqueadoraId} (${provider}) since ${since?.toISOString() || "beginning"}`);

  let erpCustomers: ERPCustomer[] = [];
  try {
    erpCustomers = await adapter.listCustomers(since);
  } catch (err) {
    const msg = `Failed to list customers: ${err instanceof Error ? err.message : String(err)}`;
    result.errorDetails.push(msg);
    console.error(`[Sync Engine] ${msg}`);
  }

  for (const erpCustomer of erpCustomers) {
    try {
      await upsertCustomer(franqueadoraId, provider, erpCustomer, result);
    } catch (err) {
      result.customersErrors++;
      const msg = `Customer ${erpCustomer.erpId}: ${err instanceof Error ? err.message : String(err)}`;
      result.errorDetails.push(msg);
      console.error(`[Sync Engine] ${msg}`);
    }
  }

  // ── 2. Sync charges ──
  console.log(`[Sync Engine] Syncing charges for ${franqueadoraId} (${provider})`);

  let erpCharges: ERPCharge[] = [];
  try {
    erpCharges = await adapter.listCharges(since);
  } catch (err) {
    const msg = `Failed to list charges: ${err instanceof Error ? err.message : String(err)}`;
    result.errorDetails.push(msg);
    console.error(`[Sync Engine] ${msg}`);
  }

  for (const erpCharge of erpCharges) {
    try {
      await upsertCharge(franqueadoraId, provider, erpCharge, result);
    } catch (err) {
      result.chargesErrors++;
      const msg = `Charge ${erpCharge.erpId}: ${err instanceof Error ? err.message : String(err)}`;
      result.errorDetails.push(msg);
      console.error(`[Sync Engine] ${msg}`);
    }
  }

  // ── 3. Sync boletos (if adapter supports it) ──
  if (adapter.listBoletos) {
    console.log(`[Sync Engine] Syncing boletos for ${franqueadoraId} (${provider})`);
    let erpBoletos: ERPBoleto[] = [];
    try {
      erpBoletos = await adapter.listBoletos(erpCharges.map(c => c.erpId));
    } catch (err) {
      const msg = `Failed to list boletos: ${err instanceof Error ? err.message : String(err)}`;
      result.errorDetails.push(msg);
      console.error(`[Sync Engine] ${msg}`);
    }

    for (const erpBoleto of erpBoletos) {
      try {
        await upsertBoleto(provider, erpBoleto, result);
      } catch (err) {
        result.boletosErrors++;
        const msg = `Boleto for charge ${erpBoleto.chargeErpId}: ${err instanceof Error ? err.message : String(err)}`;
        result.errorDetails.push(msg);
      }
    }
  }

  // ── 4. Update lastSyncAt ──
  await prisma.eRPConfig.update({
    where: { franqueadoraId },
    data: { lastSyncAt: new Date() },
  });

  console.log(
    `[Sync Engine] Done (${provider}): customers ${result.customersCreated}c/${result.customersUpdated}u/${result.customersErrors}e, charges ${result.chargesCreated}c/${result.chargesUpdated}u/${result.chargesErrors}e, boletos ${result.boletosFound}f/${result.boletosErrors}e`
  );

  return result;
}

// ---------------------------------------------------------------------------
// Customer upsert
// ---------------------------------------------------------------------------

async function upsertCustomer(
  franqueadoraId: string,
  provider: ERPProvider,
  erp: ERPCustomer,
  result: SyncResult
): Promise<void> {
  // Look up by generic erpProvider + erpCustomerId
  let existing = await prisma.customer.findFirst({
    where: { erpProvider: provider, erpCustomerId: erp.erpId, franqueadoraId },
  });

  // Fallback: look up by doc within tenant
  if (!existing && erp.doc) {
    existing = await prisma.customer.findFirst({
      where: { doc: erp.doc, franqueadoraId },
    });
  }

  const now = new Date();
  const data = {
    name: erp.name || existing?.name || "Sem nome",
    doc: erp.doc || existing?.doc || "",
    email: erp.email || existing?.email || "",
    phone: erp.phone || existing?.phone || "",
    razaoSocial: erp.razaoSocial || existing?.razaoSocial || null,
    cidade: erp.cidade || existing?.cidade || null,
    estado: erp.estado || existing?.estado || null,
    erpProvider: provider,
    erpCustomerId: erp.erpId,
    erpLastSyncAt: now,
  };

  if (existing) {
    // Last-write-wins: skip if locally edited AFTER the last sync.
    // Tolerance of 5s for Prisma's @updatedAt vs erpLastSyncAt timing.
    if (existing.updatedAt && existing.erpLastSyncAt) {
      const localEditMs = existing.updatedAt.getTime() - existing.erpLastSyncAt.getTime();
      if (localEditMs > 5000) {
        return;
      }
    }
    await prisma.customer.update({
      where: { id: existing.id },
      data,
    });
    result.customersUpdated++;
  } else {
    await prisma.customer.create({
      data: { ...data, franqueadoraId },
    });
    result.customersCreated++;
  }
}

// ---------------------------------------------------------------------------
// Charge upsert
// ---------------------------------------------------------------------------

async function upsertCharge(
  franqueadoraId: string,
  provider: ERPProvider,
  erp: ERPCharge,
  result: SyncResult
): Promise<void> {
  // Look up by generic erpProvider + erpChargeId
  let existing = await prisma.charge.findFirst({
    where: { erpProvider: provider, erpChargeId: erp.erpId },
  });

  // Find the local customer by erpCustomerId
  const customer = await prisma.customer.findFirst({
    where: { erpProvider: provider, erpCustomerId: erp.customerErpId, franqueadoraId },
  });

  if (!customer) {
    // Customer not synced yet — skip this charge
    return;
  }

  const now = new Date();
  const data = {
    customerId: customer.id,
    description: erp.description,
    amountCents: erp.amountCents,
    amountPaidCents: erp.amountPaidCents,
    dueDate: erp.dueDate,
    status: erp.status,
    paidAt: erp.status === "PAID" ? (erp.paidAt || existing?.paidAt || now) : null,
    formaPagamento: erp.formaPagamento || existing?.formaPagamento || null,
    erpProvider: provider,
    erpChargeId: erp.erpId,
    erpLastSyncAt: now,
    invoiceNumber: erp.invoiceNumber || existing?.invoiceNumber || null,
    invoicePdfUrl: erp.invoiceUrl || existing?.invoicePdfUrl || null,
  };

  if (existing) {
    // Last-write-wins: skip if locally edited AFTER the last sync.
    // Tolerance of 5s to account for Prisma's @updatedAt being set
    // slightly after erpLastSyncAt within the same DB transaction.
    if (existing.updatedAt && existing.erpLastSyncAt) {
      const localEditMs = existing.updatedAt.getTime() - existing.erpLastSyncAt.getTime();
      if (localEditMs > 5000) {
        return;
      }
    }
    await prisma.charge.update({
      where: { id: existing.id },
      data,
    });
    result.chargesUpdated++;
  } else {
    await prisma.charge.create({ data });
    result.chargesCreated++;
  }
}

// ---------------------------------------------------------------------------
// Boleto upsert
// ---------------------------------------------------------------------------

async function upsertBoleto(
  provider: ERPProvider,
  erp: ERPBoleto,
  result: SyncResult
): Promise<void> {
  const charge = await prisma.charge.findFirst({
    where: { erpProvider: provider, erpChargeId: erp.chargeErpId },
  });

  if (!charge) return;

  await prisma.boleto.upsert({
    where: { chargeId: charge.id },
    create: {
      chargeId: charge.id,
      linhaDigitavel: erp.linhaDigitavel,
      barcodeValue: erp.barcodeValue,
      publicUrl: erp.publicUrl,
    },
    update: {
      linhaDigitavel: erp.linhaDigitavel,
      barcodeValue: erp.barcodeValue,
      publicUrl: erp.publicUrl,
    },
  });
  result.boletosFound++;
}
