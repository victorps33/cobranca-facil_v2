// ---------------------------------------------------------------------------
// Omie ERP HTTP client
// Auth is sent in the JSON body (not headers).
// ---------------------------------------------------------------------------

const OMIE_BASE_URL = "https://app.omie.com.br/api/v1";
const PAGE_SIZE = 500;
const PAGE_DELAY_MS = 350;

function getCredentials() {
  const appKey = process.env.OMIE_APP_KEY;
  const appSecret = process.env.OMIE_APP_SECRET;
  if (!appKey || !appSecret) {
    throw new Error("[Omie Client] OMIE_APP_KEY and OMIE_APP_SECRET must be set");
  }
  return { appKey, appSecret };
}

export async function omieRequest<T>(
  endpoint: string,
  call: string,
  params: Record<string, unknown>
): Promise<T> {
  const { appKey, appSecret } = getCredentials();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);

  try {
    const res = await fetch(`${OMIE_BASE_URL}${endpoint}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        call,
        app_key: appKey,
        app_secret: appSecret,
        param: [params],
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`[Omie Client] HTTP ${res.status}: ${text}`);
    }

    return (await res.json()) as T;
  } finally {
    clearTimeout(timeout);
  }
}

import type { OmieBoleto, OmieCliente, OmieContaReceber } from "./types";

export async function fetchOmieBoleto(codigoTitulo: number): Promise<OmieBoleto> {
  return omieRequest<OmieBoleto>('/financas/contareceberboleto/', 'ObterBoleto', {
    nCodTitulo: codigoTitulo,
  });
}

export async function fetchOmieCliente(codigoCliente: number): Promise<OmieCliente> {
  return omieRequest<OmieCliente>('/geral/clientes/', 'ConsultarCliente', {
    codigo_cliente_omie: codigoCliente,
  });
}

export async function fetchOmieTitulo(codigoLancamento: number): Promise<OmieContaReceber> {
  return omieRequest<OmieContaReceber>('/financas/contareceber/', 'ConsultarContaReceber', {
    codigo_lancamento_omie: codigoLancamento,
  });
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export async function omieRequestAllPages<T>(
  endpoint: string,
  call: string,
  dataKey: string,
  extraParams: Record<string, unknown> = {}
): Promise<T[]> {
  const allRecords: T[] = [];
  let page = 1;
  let totalPages = 1;

  do {
    console.log(`[Omie Client] Fetching ${dataKey} page ${page}/${totalPages}`);

    const response = await omieRequest<Record<string, unknown>>(endpoint, call, {
      pagina: page,
      registros_por_pagina: PAGE_SIZE,
      ...extraParams,
    });

    totalPages = (response.total_de_paginas as number) || 1;
    const records = (response[dataKey] as T[]) || [];
    allRecords.push(...records);

    page++;
    if (page <= totalPages) {
      await sleep(PAGE_DELAY_MS);
    }
  } while (page <= totalPages);

  console.log(`[Omie Client] Fetched ${allRecords.length} ${dataKey} total`);
  return allRecords;
}
