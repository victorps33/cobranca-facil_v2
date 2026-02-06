import * as XLSX from "xlsx";
import type { Franqueado } from "@/lib/data/clientes-dummy";

// ---------------------------------------------------------------------------
// Header mapping: PT-BR (with/without accents, spaces, camelCase) → field key
// ---------------------------------------------------------------------------

const headerMap: Record<string, keyof Franqueado> = {
  // nome
  nome: "nome",
  name: "nome",

  // razaoSocial
  razaosocial: "razaoSocial",
  "razao social": "razaoSocial",
  "razão social": "razaoSocial",

  // cnpj
  cnpj: "cnpj",

  // email
  email: "email",
  "e-mail": "email",

  // telefone
  telefone: "telefone",
  phone: "telefone",
  tel: "telefone",

  // cidade
  cidade: "cidade",
  city: "cidade",

  // estado
  estado: "estado",
  uf: "estado",
  state: "estado",

  // bairro
  bairro: "bairro",
  neighborhood: "bairro",

  // dataAbertura
  dataabertura: "dataAbertura",
  "data abertura": "dataAbertura",
  "data de abertura": "dataAbertura",
  abertura: "dataAbertura",

  // responsavel
  responsavel: "responsavel",
  responsável: "responsavel",

  // statusLoja
  statusloja: "statusLoja",
  "status loja": "statusLoja",
  "status da loja": "statusLoja",
  status: "statusLoja",

  // valorEmitido
  valoremitido: "valorEmitido",
  "valor emitido": "valorEmitido",

  // valorRecebido
  valorrecebido: "valorRecebido",
  "valor recebido": "valorRecebido",

  // valorAberto
  valoraberto: "valorAberto",
  "valor aberto": "valorAberto",
  "valor em aberto": "valorAberto",

  // inadimplencia
  inadimplencia: "inadimplencia",
  inadimplência: "inadimplencia",

  // pmr
  pmr: "pmr",
};

function normalizeHeader(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // strip accents
    .replace(/_/g, " ");
}

function resolveField(raw: string): keyof Franqueado | null {
  const norm = normalizeHeader(raw);
  // direct match
  if (headerMap[norm]) return headerMap[norm];
  // try without spaces (camelCase collapsed)
  const collapsed = norm.replace(/\s+/g, "");
  if (headerMap[collapsed]) return headerMap[collapsed];
  return null;
}

// ---------------------------------------------------------------------------
// Parse spreadsheet (.xlsx / .csv) from a File → partial Franqueado rows
// ---------------------------------------------------------------------------

export interface ParseResult {
  rows: Partial<Franqueado>[];
  warnings: string[];
}

const validStatusLoja = ["Aberta", "Fechada", "Vendida"] as const;

function coerceStatusLoja(
  raw: string | undefined
): Franqueado["statusLoja"] | null {
  if (!raw) return null;
  const lower = raw.trim().toLowerCase();
  const match = validStatusLoja.find((s) => s.toLowerCase() === lower);
  return match ?? null;
}

export function parseSpreadsheetFile(file: File): Promise<ParseResult> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target!.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: "array" });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        const jsonRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(
          sheet,
          { defval: "" }
        );

        if (jsonRows.length === 0) {
          resolve({ rows: [], warnings: ["Planilha vazia."] });
          return;
        }

        // Map headers
        const sampleKeys = Object.keys(jsonRows[0]);
        const fieldMapping: Record<string, keyof Franqueado> = {};
        const unmappedHeaders: string[] = [];

        for (const key of sampleKeys) {
          const field = resolveField(key);
          if (field) {
            fieldMapping[key] = field;
          } else {
            unmappedHeaders.push(key);
          }
        }

        const warnings: string[] = [];
        if (unmappedHeaders.length > 0) {
          warnings.push(
            `Colunas ignoradas: ${unmappedHeaders.join(", ")}`
          );
        }

        const rows: Partial<Franqueado>[] = [];

        for (let i = 0; i < jsonRows.length; i++) {
          const raw = jsonRows[i];
          const partial: Record<string, unknown> = {};

          for (const [key, field] of Object.entries(fieldMapping)) {
            const val = raw[key];
            if (val === undefined || val === null || val === "") continue;

            // Numeric fields
            if (
              ["valorEmitido", "valorRecebido", "valorAberto", "inadimplencia", "pmr"].includes(field)
            ) {
              const num = Number(val);
              if (!isNaN(num)) partial[field] = num;
            } else if (field === "statusLoja") {
              const status = coerceStatusLoja(String(val));
              if (status) {
                partial[field] = status;
              } else {
                warnings.push(
                  `Linha ${i + 2}: statusLoja "${val}" inválido, será definido como "Aberta".`
                );
              }
            } else {
              partial[field] = String(val).trim();
            }
          }

          // Validate required field: nome
          if (!partial.nome) {
            warnings.push(`Linha ${i + 2}: campo "nome" vazio, registro ignorado.`);
            continue;
          }

          rows.push(partial as Partial<Franqueado>);
        }

        resolve({ rows, warnings });
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(file);
  });
}

// ---------------------------------------------------------------------------
// Fill defaults + generate IDs for imported rows
// ---------------------------------------------------------------------------

function generateUUID(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(
    /[xy]/g,
    (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === "x" ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    }
  );
}

export function completeImportedRows(
  partials: Partial<Franqueado>[]
): Franqueado[] {
  return partials.map((p) => ({
    id: generateUUID(),
    nome: p.nome ?? "",
    razaoSocial: p.razaoSocial ?? "",
    cnpj: p.cnpj ?? "",
    email: p.email ?? "",
    telefone: p.telefone ?? "",
    cidade: p.cidade ?? "",
    estado: p.estado ?? "",
    bairro: p.bairro ?? "",
    dataAbertura: p.dataAbertura ?? new Date().toISOString().slice(0, 10),
    responsavel: p.responsavel ?? "",
    statusLoja: p.statusLoja ?? "Aberta",
    valorEmitido: p.valorEmitido ?? 0,
    valorRecebido: p.valorRecebido ?? 0,
    valorAberto: p.valorAberto ?? 0,
    inadimplencia: p.inadimplencia ?? 0,
    status: "Saudável",
    pmr: p.pmr ?? 0,
  }));
}

// ---------------------------------------------------------------------------
// Export franqueados to .xlsx and trigger browser download
// ---------------------------------------------------------------------------

const exportHeaders: { label: string; key: keyof Franqueado }[] = [
  { label: "Nome", key: "nome" },
  { label: "Razão Social", key: "razaoSocial" },
  { label: "CNPJ", key: "cnpj" },
  { label: "Email", key: "email" },
  { label: "Telefone", key: "telefone" },
  { label: "Cidade", key: "cidade" },
  { label: "Estado", key: "estado" },
  { label: "Bairro", key: "bairro" },
  { label: "Data Abertura", key: "dataAbertura" },
  { label: "Responsável", key: "responsavel" },
  { label: "Status Loja", key: "statusLoja" },
  { label: "Valor Emitido", key: "valorEmitido" },
  { label: "Valor Recebido", key: "valorRecebido" },
  { label: "Valor Aberto", key: "valorAberto" },
  { label: "Inadimplência", key: "inadimplencia" },
  { label: "Status", key: "status" },
  { label: "PMR", key: "pmr" },
];

export function exportFranqueadosToXlsx(franqueados: Franqueado[]) {
  const data = franqueados.map((f) => {
    const row: Record<string, unknown> = {};
    for (const h of exportHeaders) {
      row[h.label] = f[h.key];
    }
    return row;
  });

  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Franqueados");

  const today = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(wb, `franqueados_${today}.xlsx`);
}
