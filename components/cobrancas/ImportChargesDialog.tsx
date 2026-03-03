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
import { Upload, FileSpreadsheet, AlertTriangle, Loader2, Sparkles } from "lucide-react";
import { cn } from "@/lib/cn";
import { useFranqueadora } from "@/components/providers/FranqueadoraProvider";
import { getFranqueadoraHeaders } from "@/lib/fetch-with-tenant";
import * as XLSX from "xlsx";

interface ChargePreview {
  customerName: string;
  customerId: string | null;
  description: string;
  amountCents: number;
  dueDate: string;
  status: string;
  paidAt: string | null;
  categoria: string | null;
  competencia: string | null;
}

interface ImportChargesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImportComplete: () => void;
}

type DialogState = "idle" | "parsing" | "preview" | "importing";

export function ImportChargesDialog({ open, onOpenChange, onImportComplete }: ImportChargesDialogProps) {
  const { toast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const { activeFranqueadoraId, isGroupUser } = useFranqueadora();

  const [state, setState] = useState<DialogState>("idle");
  const [dragOver, setDragOver] = useState(false);
  const [charges, setCharges] = useState<ChargePreview[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [summary, setSummary] = useState<string | null>(null);
  const [targetFranqueadoraId, setTargetFranqueadoraId] = useState<string | null>(null);

  const fmtBRL = (cents: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);

  const handleOpenChange = useCallback((val: boolean) => {
    if (!val) {
      setState("idle");
      setCharges([]);
      setWarnings([]);
      setSummary(null);
      setDragOver(false);
      setTargetFranqueadoraId(null);
    }
    onOpenChange(val);
  }, [onOpenChange]);

  // ---------- Local fallback for charge parsing ----------

  const excelSerialToDate = (serial: number): string => {
    const utcDays = Math.floor(serial - 25569);
    const d = new Date(utcDays * 86400 * 1000);
    return d.toISOString().split("T")[0];
  };

  const parseChargesLocally = useCallback(
    async (file: File): Promise<boolean> => {
      const data = await file.arrayBuffer();
      const wb = XLSX.read(data);
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: "" });

      if (rows.length === 0) return false;

      // Detect columns by normalized header
      const headers = Object.keys(rows[0]);
      const norm = (s: string) =>
        s.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

      let nameCol: string | null = null;
      let franquiaCol: string | null = null;
      let dateCol: string | null = null;
      let valueCol: string | null = null;
      let typeCol: string | null = null;

      for (const h of headers) {
        const n = norm(h);
        if (n.includes("nome") && n.includes("franqueado")) nameCol = h;
        else if (n === "franquia" || n === "unidade" || n === "filial") franquiaCol = h;
        else if (n.includes("vencimento") || n.includes("data")) dateCol = h;
        else if (n === "valor" || n.includes("amount") || n.includes("valor total")) valueCol = h;
        else if (n === "tipo" || n === "categoria" || n === "descricao" || n === "description") typeCol = h;
      }

      if (!nameCol && !valueCol) return false;

      // Fetch existing customers to match
      const tenantHeaders = getFranqueadoraHeaders();
      const custResponse = await fetch("/api/customers", { headers: tenantHeaders });
      const customers: { id: string; nome: string }[] = custResponse.ok
        ? await custResponse.json()
        : [];

      // Build name → customer mapping (fuzzy: lowercase + trim)
      const customerMap = new Map<string, { id: string; nome: string }>();
      for (const c of customers) {
        customerMap.set(c.nome.toLowerCase().trim(), c);
        const parts = c.nome.split(" – ");
        if (parts.length > 1) {
          customerMap.set(parts[parts.length - 1].toLowerCase().trim(), c);
        }
      }

      // Collect unique customer names that need to be auto-created
      const uniqueNames = new Set<string>();
      for (const row of rows) {
        const rawName = nameCol ? String(row[nameCol] ?? "").trim() : "";
        const franquia = franquiaCol ? String(row[franquiaCol] ?? "").trim() : "";
        const composedName = franquia && rawName ? `${franquia} – ${rawName}` : rawName;
        if (!composedName) continue;
        const key = composedName.toLowerCase().trim();
        if (!customerMap.has(key)) uniqueNames.add(composedName);
      }

      // Auto-create missing customers
      let autoCreated = 0;
      for (const name of Array.from(uniqueNames)) {
        try {
          const res = await fetch("/api/customers", {
            method: "POST",
            headers: { "Content-Type": "application/json", ...tenantHeaders },
            body: JSON.stringify({ name, doc: "", email: "", phone: "" }),
          });
          if (res.ok) {
            const created = await res.json();
            customerMap.set(name.toLowerCase().trim(), { id: created.id, nome: name });
            autoCreated++;
          }
        } catch { /* skip */ }
      }

      const today = new Date().toISOString().split("T")[0];
      const localWarnings: string[] = [];

      if (autoCreated > 0) {
        localWarnings.push(
          `${autoCreated} franqueado${autoCreated !== 1 ? "s" : ""} criado${autoCreated !== 1 ? "s" : ""} automaticamente no cadastro.`
        );
      }

      const parsedCharges: ChargePreview[] = [];

      for (const row of rows) {
        const rawName = nameCol ? String(row[nameCol] ?? "").trim() : "";
        const franquia = franquiaCol ? String(row[franquiaCol] ?? "").trim() : "";
        const composedName = franquia && rawName ? `${franquia} – ${rawName}` : rawName;

        if (!composedName) continue;

        // Match customer (now includes auto-created ones)
        const matchKey = composedName.toLowerCase().trim();
        const nameOnlyKey = rawName.toLowerCase().trim();
        const matched = customerMap.get(matchKey) || customerMap.get(nameOnlyKey) || null;

        // Parse date
        let dueDate = today;
        if (dateCol) {
          const rawDate = row[dateCol];
          if (typeof rawDate === "number" && rawDate > 10000) {
            dueDate = excelSerialToDate(rawDate);
          } else if (typeof rawDate === "string" && rawDate.includes("-")) {
            dueDate = rawDate;
          }
        }

        // Parse value (BRL → cents)
        let amountCents = 0;
        if (valueCol) {
          const rawVal = row[valueCol];
          const num = typeof rawVal === "number" ? rawVal : parseFloat(String(rawVal).replace(/[^\d.,]/g, "").replace(",", "."));
          if (!isNaN(num)) {
            amountCents = Math.round(num * 100);
          }
        }

        const description = typeCol ? String(row[typeCol] ?? "").trim() : "Cobrança";
        const isOverdue = dueDate < today;

        parsedCharges.push({
          customerName: composedName,
          customerId: matched?.id ?? null,
          description,
          amountCents,
          dueDate,
          status: isOverdue ? "OVERDUE" : "PENDING",
          paidAt: null,
          categoria: typeCol ? String(row[typeCol] ?? "").trim() : null,
          competencia: null,
        });
      }

      if (parsedCharges.length === 0) return false;

      const matched = parsedCharges.filter((c) => c.customerId).length;

      setCharges(parsedCharges);
      setWarnings(localWarnings);
      setSummary(
        `${parsedCharges.length} cobranças extraídas da planilha. ${matched} associadas a clientes.`
      );
      setTargetFranqueadoraId(
        activeFranqueadoraId && activeFranqueadoraId !== "all" ? activeFranqueadoraId : null
      );
      return true;
    },
    [activeFranqueadoraId]
  );

  // ---------- File processing ----------

  const processFile = useCallback(async (file: File) => {
    // Check if a specific franqueadora is selected (not "all" for group users)
    if (isGroupUser && activeFranqueadoraId === "all") {
      toast({
        title: "Selecione uma subsidiária",
        description: "Para importar cobranças, selecione uma subsidiária específica no menu lateral.",
        variant: "destructive",
      });
      return;
    }

    setState("parsing");

    // Try AI first
    try {
      const formData = new FormData();
      formData.append("file", file);

      // Convert XLSX to CSV for AI readability
      const ext = file.name.substring(file.name.lastIndexOf(".")).toLowerCase();
      if ([".xlsx", ".xls"].includes(ext)) {
        try {
          const buf = await file.arrayBuffer();
          const wb = XLSX.read(buf);
          const ws = wb.Sheets[wb.SheetNames[0]];
          const csvText = XLSX.utils.sheet_to_csv(ws);
          if (csvText.trim()) {
            const csvBlob = new Blob([csvText], { type: "text/csv" });
            const csvFile = new File([csvBlob], file.name.replace(/\.\w+$/, ".csv"), { type: "text/csv" });
            formData.set("file", csvFile);
          }
        } catch { /* send original */ }
      }

      const hdrs: Record<string, string> = {};
      if (activeFranqueadoraId && activeFranqueadoraId !== "all") {
        hdrs["x-franqueadora-id"] = activeFranqueadoraId;
      }

      const response = await fetch("/api/charges/upload", {
        method: "POST",
        headers: hdrs,
        body: formData,
      });

      if (!response.ok) throw new Error("AI unavailable");

      const data = await response.json();

      if (data.charges && data.charges.length > 0) {
        setCharges(data.charges);
        setWarnings(data.warnings || []);
        setSummary(data.summary || null);
        setTargetFranqueadoraId(data.targetFranqueadoraId);
        setState("preview");
        return;
      }
    } catch {
      // AI failed, try local fallback
    }

    // Local fallback
    const ext = file.name.substring(file.name.lastIndexOf(".")).toLowerCase();
    if ([".xlsx", ".xls", ".csv"].includes(ext)) {
      try {
        const success = await parseChargesLocally(file);
        if (success) {
          setState("preview");
          return;
        }
      } catch (err) {
        console.error("Local charge parsing failed:", err);
        toast({
          title: "Erro no parser local",
          description: err instanceof Error ? err.message : String(err),
          variant: "destructive",
        });
        setState("idle");
        return;
      }
    }

    toast({
      title: "Erro ao processar arquivo",
      description: "Formato não suportado ou arquivo vazio.",
      variant: "destructive",
    });
    setState("idle");
  }, [activeFranqueadoraId, isGroupUser, toast, parseChargesLocally]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  }, [processFile]);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
    e.target.value = "";
  }, [processFile]);

  const handleConfirmImport = useCallback(async () => {
    if (!targetFranqueadoraId) return;

    setState("importing");

    try {
      const response = await fetch("/api/charges/upload/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ charges, franqueadoraId: targetFranqueadoraId }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Erro ao importar");
      }

      const data = await response.json();

      toast({
        title: "Importação concluída",
        description: `${data.imported} cobrança${data.imported !== 1 ? "s" : ""} importada${data.imported !== 1 ? "s" : ""} com sucesso.`,
      });

      onImportComplete();
      handleOpenChange(false);
    } catch (err) {
      toast({
        title: "Erro ao importar",
        description: err instanceof Error ? err.message : "Tente novamente.",
        variant: "destructive",
      });
      setState("preview");
    }
  }, [charges, targetFranqueadoraId, toast, onImportComplete, handleOpenChange]);

  const validCharges = charges.filter((c) => c.customerId);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Importar Cobranças</DialogTitle>
          <DialogDescription>
            Envie um arquivo com dados de cobranças. A IA vai interpretar e associar aos clientes cadastrados.
          </DialogDescription>
        </DialogHeader>

        {/* IDLE — Drop zone */}
        {state === "idle" && (
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => inputRef.current?.click()}
            className={cn(
              "flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed p-10 cursor-pointer transition-colors",
              dragOver
                ? "border-primary bg-orange-50/50"
                : "border-gray-200 hover:border-gray-300 hover:bg-gray-50/50"
            )}
          >
            <div className={cn(
              "flex h-12 w-12 items-center justify-center rounded-full",
              dragOver ? "bg-orange-100" : "bg-gray-100"
            )}>
              <Upload className={cn("h-5 w-5", dragOver ? "text-primary" : "text-gray-400")} />
            </div>
            <div className="text-center">
              <p className="text-sm font-medium text-gray-700">
                Arraste um arquivo aqui ou{" "}
                <span className="text-primary">clique para selecionar</span>
              </p>
              <p className="mt-1 text-xs text-gray-400">
                Formatos aceitos: .xlsx, .csv, .txt e outros
              </p>
            </div>
            <input ref={inputRef} type="file" onChange={handleFileChange} className="hidden" />
          </div>
        )}

        {/* PARSING / IMPORTING — Spinner */}
        {(state === "parsing" || state === "importing") && (
          <div className="flex flex-col items-center justify-center gap-3 py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-gray-500">
              {state === "parsing" ? "Processando arquivo com IA..." : "Importando cobranças..."}
            </p>
          </div>
        )}

        {/* PREVIEW */}
        {state === "preview" && (
          <div className="space-y-4">
            {summary && (
              <div className="rounded-lg bg-blue-50/50 border border-blue-100 p-3">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                  <Sparkles className="h-3.5 w-3.5 text-secondary" />
                  Resumo da IA
                </div>
                <p className="text-sm text-gray-700 leading-relaxed">{summary}</p>
              </div>
            )}

            <div className="flex items-center gap-2 text-sm">
              <FileSpreadsheet className="h-4 w-4 text-gray-400" />
              <span className="text-gray-700">
                <strong>{validCharges.length}</strong> cobrança{validCharges.length !== 1 ? "s" : ""} para importar
              </span>
              {charges.length - validCharges.length > 0 && (
                <span className="text-amber-600 text-xs">
                  ({charges.length - validCharges.length} sem cliente associado)
                </span>
              )}
            </div>

            {warnings.length > 0 && (
              <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 space-y-1">
                <div className="flex items-center gap-1.5 text-xs font-medium text-amber-700">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  Avisos
                </div>
                <ul className="text-xs text-amber-600 space-y-0.5 max-h-24 overflow-y-auto">
                  {warnings.map((w, i) => (
                    <li key={i}>{w}</li>
                  ))}
                </ul>
              </div>
            )}

            {validCharges.length > 0 && (
              <div className="overflow-x-auto rounded-lg border border-gray-100">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50/80">
                      <th className="px-3 py-2 text-left font-medium text-gray-500">Cliente</th>
                      <th className="px-3 py-2 text-left font-medium text-gray-500">Descrição</th>
                      <th className="px-3 py-2 text-right font-medium text-gray-500">Valor</th>
                      <th className="px-3 py-2 text-left font-medium text-gray-500">Vencimento</th>
                      <th className="px-3 py-2 text-left font-medium text-gray-500">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {validCharges.slice(0, 8).map((c, i) => (
                      <tr key={i} className="border-b border-gray-50">
                        <td className="px-3 py-2 text-gray-700">{c.customerName}</td>
                        <td className="px-3 py-2 text-gray-500 max-w-[150px] truncate">{c.description}</td>
                        <td className="px-3 py-2 text-right text-gray-700 font-medium">{fmtBRL(c.amountCents)}</td>
                        <td className="px-3 py-2 text-gray-500">{c.dueDate}</td>
                        <td className="px-3 py-2 text-gray-500">{c.status}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {validCharges.length > 8 && (
                  <div className="px-3 py-2 text-xs text-gray-400 bg-gray-50/50 border-t border-gray-100">
                    e mais {validCharges.length - 8} cobrança{validCharges.length - 8 !== 1 ? "s" : ""}...
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
                disabled={validCharges.length === 0}
                className="px-5 py-2 text-sm font-medium text-white bg-primary rounded-full hover:bg-primary-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Importar {validCharges.length} cobrança{validCharges.length !== 1 ? "s" : ""}
              </button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
