"use client";

import { useCallback, useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";
import { Upload, FileSpreadsheet, AlertTriangle, Loader2 } from "lucide-react";
import { cn } from "@/lib/cn";
import {
  parseSpreadsheetFile,
  completeImportedRows,
  type ParseResult,
} from "@/lib/franqueados-import-export";
import type { Franqueado } from "@/lib/data/clientes-dummy";

type DialogState = "idle" | "parsing" | "preview";

const ACCEPTED_EXTENSIONS = [".xlsx", ".csv"];
const ACCEPTED_MIME =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv";

interface ImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  existingFranqueados: Franqueado[];
  onImport: (rows: Franqueado[]) => void;
}

export function ImportDialog({
  open,
  onOpenChange,
  existingFranqueados,
  onImport,
}: ImportDialogProps) {
  const { toast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);

  const [state, setState] = useState<DialogState>("idle");
  const [dragOver, setDragOver] = useState(false);
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
  const [completed, setCompleted] = useState<Franqueado[]>([]);
  const [duplicateCnpjs, setDuplicateCnpjs] = useState<string[]>([]);

  // Reset state when dialog closes
  const handleOpenChange = useCallback(
    (val: boolean) => {
      if (!val) {
        setState("idle");
        setParseResult(null);
        setCompleted([]);
        setDuplicateCnpjs([]);
        setDragOver(false);
      }
      onOpenChange(val);
    },
    [onOpenChange]
  );

  // ---------- File processing ----------

  const processFile = useCallback(
    async (file: File) => {
      const ext = file.name.substring(file.name.lastIndexOf(".")).toLowerCase();

      if (ext === ".pdf") {
        toast({
          title: "Formato não suportado",
          description:
            "Arquivos PDF não podem ser importados automaticamente. Use .xlsx ou .csv.",
          variant: "destructive",
        });
        return;
      }

      if (!ACCEPTED_EXTENSIONS.includes(ext)) {
        toast({
          title: "Formato não suportado",
          description: `Formato "${ext}" não suportado. Use .xlsx ou .csv.`,
          variant: "destructive",
        });
        return;
      }

      setState("parsing");

      try {
        const result = await parseSpreadsheetFile(file);

        if (result.rows.length === 0) {
          toast({
            title: "Nenhum registro encontrado",
            description:
              "A planilha não contém registros válidos. Verifique se os cabeçalhos estão corretos.",
            variant: "destructive",
          });
          setState("idle");
          return;
        }

        const completedRows = completeImportedRows(result.rows);

        // Deduplication by CNPJ
        const existingCnpjs = new Set(
          existingFranqueados
            .map((f) => f.cnpj)
            .filter((c) => c.length > 0)
        );

        const dupes: string[] = [];
        const unique = completedRows.filter((row) => {
          if (row.cnpj && existingCnpjs.has(row.cnpj)) {
            dupes.push(row.cnpj);
            return false;
          }
          return true;
        });

        setParseResult(result);
        setCompleted(unique);
        setDuplicateCnpjs(dupes);
        setState("preview");
      } catch {
        toast({
          title: "Erro ao processar arquivo",
          description:
            "Não foi possível ler a planilha. Verifique se o arquivo está correto.",
          variant: "destructive",
        });
        setState("idle");
      }
    },
    [existingFranqueados, toast]
  );

  // ---------- Event handlers ----------

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) processFile(file);
    },
    [processFile]
  );

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) processFile(file);
      // Reset input so same file can be selected again
      e.target.value = "";
    },
    [processFile]
  );

  const handleConfirmImport = useCallback(() => {
    onImport(completed);
    toast({
      title: "Importação concluída",
      description: `${completed.length} franqueado${completed.length !== 1 ? "s" : ""} importado${completed.length !== 1 ? "s" : ""} com sucesso.`,
    });
    handleOpenChange(false);
  }, [completed, onImport, toast, handleOpenChange]);

  // ---------- Render ----------

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Importar Franqueados</DialogTitle>
          <DialogDescription>
            Faça upload de uma planilha .xlsx ou .csv para importar franqueados.
          </DialogDescription>
        </DialogHeader>

        {/* IDLE — Drop zone */}
        {state === "idle" && (
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => inputRef.current?.click()}
            className={cn(
              "flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed p-10 cursor-pointer transition-colors",
              dragOver
                ? "border-[#F85B00] bg-orange-50/50"
                : "border-gray-200 hover:border-gray-300 hover:bg-gray-50/50"
            )}
          >
            <div
              className={cn(
                "flex h-12 w-12 items-center justify-center rounded-full",
                dragOver ? "bg-orange-100" : "bg-gray-100"
              )}
            >
              <Upload
                className={cn(
                  "h-5 w-5",
                  dragOver ? "text-[#F85B00]" : "text-gray-400"
                )}
              />
            </div>
            <div className="text-center">
              <p className="text-sm font-medium text-gray-700">
                Arraste um arquivo aqui ou{" "}
                <span className="text-[#F85B00]">clique para selecionar</span>
              </p>
              <p className="mt-1 text-xs text-gray-400">
                Formatos aceitos: .xlsx, .csv
              </p>
            </div>
            <input
              ref={inputRef}
              type="file"
              accept={ACCEPTED_MIME}
              onChange={handleFileChange}
              className="hidden"
            />
          </div>
        )}

        {/* PARSING — Spinner */}
        {state === "parsing" && (
          <div className="flex flex-col items-center justify-center gap-3 py-12">
            <Loader2 className="h-8 w-8 animate-spin text-[#F85B00]" />
            <p className="text-sm text-gray-500">Processando planilha...</p>
          </div>
        )}

        {/* PREVIEW — Table + warnings */}
        {state === "preview" && parseResult && (
          <div className="space-y-4">
            {/* Summary */}
            <div className="flex items-center gap-2 text-sm">
              <FileSpreadsheet className="h-4 w-4 text-gray-400" />
              <span className="text-gray-700">
                <strong>{completed.length}</strong> registro
                {completed.length !== 1 ? "s" : ""} para importar
              </span>
              {duplicateCnpjs.length > 0 && (
                <span className="text-amber-600 text-xs">
                  ({duplicateCnpjs.length} duplicado
                  {duplicateCnpjs.length !== 1 ? "s" : ""} por CNPJ
                  {duplicateCnpjs.length !== 1 ? " foram" : " foi"} ignorado
                  {duplicateCnpjs.length !== 1 ? "s" : ""})
                </span>
              )}
            </div>

            {/* Warnings */}
            {parseResult.warnings.length > 0 && (
              <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 space-y-1">
                <div className="flex items-center gap-1.5 text-xs font-medium text-amber-700">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  Avisos
                </div>
                <ul className="text-xs text-amber-600 space-y-0.5 max-h-24 overflow-y-auto">
                  {parseResult.warnings.map((w, i) => (
                    <li key={i}>• {w}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Preview table (first 5 rows) */}
            {completed.length > 0 && (
              <div className="overflow-x-auto rounded-lg border border-gray-100">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50/80">
                      <th className="px-3 py-2 text-left font-medium text-gray-500">
                        Nome
                      </th>
                      <th className="px-3 py-2 text-left font-medium text-gray-500">
                        CNPJ
                      </th>
                      <th className="px-3 py-2 text-left font-medium text-gray-500">
                        Cidade/UF
                      </th>
                      <th className="px-3 py-2 text-left font-medium text-gray-500">
                        Status
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {completed.slice(0, 5).map((row) => (
                      <tr
                        key={row.id}
                        className="border-b border-gray-50"
                      >
                        <td className="px-3 py-2 text-gray-700">
                          {row.nome}
                        </td>
                        <td className="px-3 py-2 text-gray-500">
                          {row.cnpj || "—"}
                        </td>
                        <td className="px-3 py-2 text-gray-500">
                          {row.cidade
                            ? `${row.cidade}/${row.estado}`
                            : "—"}
                        </td>
                        <td className="px-3 py-2 text-gray-500">
                          {row.statusLoja}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {completed.length > 5 && (
                  <div className="px-3 py-2 text-xs text-gray-400 bg-gray-50/50 border-t border-gray-100">
                    e mais {completed.length - 5} registro
                    {completed.length - 5 !== 1 ? "s" : ""}...
                  </div>
                )}
              </div>
            )}

            <DialogFooter>
              <button
                onClick={() => handleOpenChange(false)}
                className="px-4 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-full hover:bg-gray-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmImport}
                disabled={completed.length === 0}
                className="px-5 py-2 text-sm font-medium text-white bg-[#F85B00] rounded-full hover:bg-[#e05200] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Importar {completed.length} registro
                {completed.length !== 1 ? "s" : ""}
              </button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
