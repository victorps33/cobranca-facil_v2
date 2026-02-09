import * as XLSX from "xlsx";
import type { Cobranca } from "@/lib/data/cobrancas-dummy";

const exportHeaders: { label: string; key: keyof Cobranca | "_valorOriginalReais" | "_valorPagoReais" | "_valorAbertoReais" | "_nfEmitida" }[] = [
  { label: "ID", key: "id" },
  { label: "Cliente", key: "cliente" },
  { label: "Categoria", key: "categoria" },
  { label: "Descrição", key: "descricao" },
  { label: "Data Emissão", key: "dataEmissao" },
  { label: "Data Vencimento", key: "dataVencimento" },
  { label: "Data Pagamento", key: "dataPagamento" },
  { label: "Valor Original (R$)", key: "_valorOriginalReais" },
  { label: "Valor Pago (R$)", key: "_valorPagoReais" },
  { label: "Valor Aberto (R$)", key: "_valorAbertoReais" },
  { label: "Forma de Pagamento", key: "formaPagamento" },
  { label: "Status", key: "status" },
  { label: "NF Emitida", key: "_nfEmitida" },
  { label: "Competência", key: "competencia" },
];

function centsToReais(cents: number): number {
  return cents / 100;
}

export function exportCobrancasToXlsx(cobrancas: Cobranca[]) {
  const data = cobrancas.map((c) => {
    const row: Record<string, unknown> = {};
    for (const h of exportHeaders) {
      switch (h.key) {
        case "_valorOriginalReais":
          row[h.label] = centsToReais(c.valorOriginal);
          break;
        case "_valorPagoReais":
          row[h.label] = centsToReais(c.valorPago);
          break;
        case "_valorAbertoReais":
          row[h.label] = centsToReais(c.valorAberto);
          break;
        case "_nfEmitida":
          row[h.label] = c.nfEmitida ? "Sim" : "Não";
          break;
        default:
          row[h.label] = c[h.key as keyof Cobranca] ?? "";
          break;
      }
    }
    return row;
  });

  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Cobranças");

  const today = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(wb, `cobrancas_${today}.xlsx`);
}
