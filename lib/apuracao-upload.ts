import * as XLSX from "xlsx";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ApuracaoRow {
  nome: string;
  pdv: number;
  ifood: number;
  rappi: number;
  total: number;
  mesAnterior: number;
  [key: string]: unknown;
}

export interface ApuracaoParseResult {
  rows: ApuracaoRow[];
  warnings: string[];
  rawHeaders: string[];
  rawPreview: string[][];
}

// ---------------------------------------------------------------------------
// Header mapping: PT-BR variations → field key
// ---------------------------------------------------------------------------

type ApuracaoField = keyof ApuracaoRow;

const headerMap: Record<string, ApuracaoField> = {
  // nome / franqueado
  nome: "nome",
  franqueado: "nome",
  franquia: "nome",
  name: "nome",
  unidade: "nome",

  // pdv
  pdv: "pdv",
  "ponto de venda": "pdv",
  "faturamento pdv": "pdv",
  loja: "pdv",

  // ifood
  ifood: "ifood",
  "i-food": "ifood",
  "faturamento ifood": "ifood",

  // rappi
  rappi: "rappi",
  "faturamento rappi": "rappi",

  // total
  total: "total",
  "faturamento total": "total",
  faturamento: "total",
  "total faturamento": "total",

  // mesAnterior
  mesanterior: "mesAnterior",
  "mes anterior": "mesAnterior",
  "mês anterior": "mesAnterior",
  anterior: "mesAnterior",
  "fat anterior": "mesAnterior",
  "faturamento anterior": "mesAnterior",
};

function normalizeHeader(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/_/g, " ");
}

function resolveField(raw: string): ApuracaoField | null {
  const norm = normalizeHeader(raw);
  if (headerMap[norm]) return headerMap[norm];
  const collapsed = norm.replace(/\s+/g, "");
  if (headerMap[collapsed]) return headerMap[collapsed];
  return null;
}

// ---------------------------------------------------------------------------
// Parse currency string → number (centavos)
// ---------------------------------------------------------------------------

function parseCurrency(val: unknown): number {
  if (typeof val === "number") return Math.round(val * 100);
  if (typeof val !== "string") return 0;

  const cleaned = val
    .replace(/[R$\s]/g, "")
    .replace(/\./g, "")
    .replace(",", ".");

  const num = parseFloat(cleaned);
  if (isNaN(num)) return 0;
  return Math.round(num * 100);
}

// ---------------------------------------------------------------------------
// Parse spreadsheet file
// ---------------------------------------------------------------------------

export function parseApuracaoFile(file: File): Promise<ApuracaoParseResult> {
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
          resolve({
            rows: [],
            warnings: ["Planilha vazia."],
            rawHeaders: [],
            rawPreview: [],
          });
          return;
        }

        const rawHeaders = Object.keys(jsonRows[0]);

        // Build raw preview (first 5 rows)
        const rawPreview = jsonRows.slice(0, 5).map((row) =>
          rawHeaders.map((h) => String(row[h] ?? ""))
        );

        // Map headers
        const fieldMapping: Record<string, ApuracaoField> = {};
        const unmappedHeaders: string[] = [];

        for (const key of rawHeaders) {
          const field = resolveField(key);
          if (field) {
            fieldMapping[key] = field;
          } else {
            unmappedHeaders.push(key);
          }
        }

        const warnings: string[] = [];
        if (unmappedHeaders.length > 0) {
          warnings.push(`Colunas ignoradas: ${unmappedHeaders.join(", ")}`);
        }

        const rows: ApuracaoRow[] = [];

        for (let i = 0; i < jsonRows.length; i++) {
          const raw = jsonRows[i];
          const partial: Record<string, unknown> = {};

          for (const [key, field] of Object.entries(fieldMapping)) {
            const val = raw[key];
            if (val === undefined || val === null || val === "") continue;

            if (field === "nome") {
              partial[field] = String(val).trim();
            } else {
              partial[field] = parseCurrency(val);
            }
          }

          if (!partial.nome) {
            warnings.push(
              `Linha ${i + 2}: campo "nome/franqueado" vazio, registro ignorado.`
            );
            continue;
          }

          rows.push({
            nome: partial.nome as string,
            pdv: (partial.pdv as number) ?? 0,
            ifood: (partial.ifood as number) ?? 0,
            rappi: (partial.rappi as number) ?? 0,
            total: (partial.total as number) ?? 0,
            mesAnterior: (partial.mesAnterior as number) ?? 0,
          });
        }

        // Auto-calculate total if missing but has pdv/ifood/rappi
        for (const row of rows) {
          if (row.total === 0 && (row.pdv > 0 || row.ifood > 0 || row.rappi > 0)) {
            row.total = row.pdv + row.ifood + row.rappi;
          }
        }

        resolve({ rows, warnings, rawHeaders, rawPreview });
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(file);
  });
}
