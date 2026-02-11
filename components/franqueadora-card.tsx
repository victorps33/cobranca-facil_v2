"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "@/components/ui/use-toast";
import {
  Building2,
  Pencil,
  Loader2,
  ChevronDown,
  Plus,
  Mail,
  Phone,
  MapPin,
  User,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/cn";

interface ContatoFranqueadora {
  id?: string;
  nome: string;
  telefone: string;
  isPrimario: boolean;
}

interface Franqueadora {
  id: string;
  nome: string;
  razaoSocial: string;
  cnpj: string | null;
  email: string;
  emailSecundario: string | null;
  endereco: string | null;
  celular: string | null;
  celularSecundario: string | null;
  telefone: string | null;
  telefoneSecundario: string | null;
  responsavel: string | null;
  contatos?: ContatoFranqueadora[];
  createdAt: string;
  updatedAt: string;
}

const EMPTY_FORM = {
  nome: "",
  razaoSocial: "",
  cnpj: "",
  email: "",
  emailSecundario: "",
  endereco: "",
  celular: "",
  celularSecundario: "",
  telefone: "",
  telefoneSecundario: "",
  responsavel: "",
};

export function FranqueadoraCard() {
  const [data, setData] = useState<Franqueadora | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [formLoading, setFormLoading] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [contatos, setContatos] = useState<ContatoFranqueadora[]>([]);
  const [errors, setErrors] = useState<string[]>([]);

  const fetchData = async () => {
    try {
      const res = await fetch("/api/franqueadora");
      const json = await res.json();
      setData(json);
      if (!json) setExpanded(true);
      if (json) {
        setForm({
          nome: json.nome || "",
          razaoSocial: json.razaoSocial || "",
          cnpj: json.cnpj || "",
          email: json.email || "",
          emailSecundario: json.emailSecundario || "",
          endereco: json.endereco || "",
          celular: json.celular || "",
          celularSecundario: json.celularSecundario || "",
          telefone: json.telefone || "",
          telefoneSecundario: json.telefoneSecundario || "",
          responsavel: json.responsavel || "",
        });
        if (json.contatos?.length) {
          setContatos(json.contatos.map((c: ContatoFranqueadora) => ({
            nome: c.nome,
            telefone: c.telefone,
            isPrimario: c.isPrimario,
          })));
        }
      }
    } catch {
      setExpanded(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleOpenDialog = () => {
    if (data) {
      setForm({
        nome: data.nome || "",
        razaoSocial: data.razaoSocial || "",
        cnpj: data.cnpj || "",
        email: data.email || "",
        emailSecundario: data.emailSecundario || "",
        endereco: data.endereco || "",
        celular: data.celular || "",
        celularSecundario: data.celularSecundario || "",
        telefone: data.telefone || "",
        telefoneSecundario: data.telefoneSecundario || "",
        responsavel: data.responsavel || "",
      });
      if (data.contatos?.length) {
        setContatos(data.contatos.map((c) => ({
          nome: c.nome,
          telefone: c.telefone,
          isPrimario: c.isPrimario,
        })));
      } else {
        setContatos([]);
      }
    } else {
      setForm(EMPTY_FORM);
      setContatos([]);
    }
    setErrors([]);
    setDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormLoading(true);
    setErrors([]);

    try {
      const res = await fetch("/api/franqueadora", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, contatos }),
      });

      if (!res.ok) {
        const errBody = await res.json();
        if (errBody.errors) {
          setErrors(errBody.errors);
          setFormLoading(false);
          return;
        }
        throw new Error("Falha ao salvar");
      }

      const updated = await res.json();
      const isCreating = !data;
      setData(updated);

      toast({
        title: isCreating ? "Franqueadora cadastrada!" : "Franqueadora atualizada!",
        description: "Os dados foram salvos com sucesso.",
      });

      setDialogOpen(false);

      // Recarregar a página após criar para atualizar a sessão JWT com o novo franqueadoraId
      if (isCreating) {
        window.location.reload();
      }
    } catch {
      toast({
        title: "Erro",
        description: "Falha ao salvar dados da franqueadora.",
        variant: "destructive",
      });
    } finally {
      setFormLoading(false);
    }
  };

  const updateField = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const isComplete = data ? !!(data.nome && data.razaoSocial && data.email) : false;

  if (loading) {
    return (
      <div className="bg-white rounded-2xl border border-gray-100 p-6">
        <div className="flex items-center gap-3">
          <Loader2 className="h-4 w-4 animate-spin text-gray-400" aria-hidden="true" />
          <span className="text-sm text-gray-400">Carregando dados da franqueadora...</span>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        {/* Header — sempre visível, clicável para expandir/colapsar */}
        <button
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          className="w-full flex items-center justify-between px-6 py-4 text-left hover:bg-gray-50/50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gray-100">
              <Building2 className="h-4 w-4 text-gray-600" aria-hidden="true" />
            </div>
            <div className="flex items-center gap-3">
              <h2 className="text-sm font-semibold text-gray-900">Dados da Franqueadora</h2>
              {data ? (
                <>
                  <Badge
                    className={
                      isComplete
                        ? "bg-emerald-50 text-emerald-700 border-transparent"
                        : "bg-amber-50 text-amber-700 border-transparent"
                    }
                  >
                    {isComplete ? "Completo" : "Incompleto"}
                  </Badge>
                  {!expanded && (
                    <span className="text-sm text-gray-400 hidden sm:inline">
                      {data.nome}
                    </span>
                  )}
                </>
              ) : (
                <Badge className="bg-gray-50 text-gray-500 border-transparent">
                  Não cadastrado
                </Badge>
              )}
            </div>
          </div>
          <ChevronDown
            className={cn(
              "h-4 w-4 text-gray-400 transition-transform",
              expanded && "rotate-180"
            )}
            aria-hidden="true"
          />
        </button>

        {/* Conteúdo — colapsável */}
        {expanded && (
          <div className="px-6 pb-5 border-t border-gray-100">
            {data ? (
              <div className="pt-4 space-y-4">
                {/* Row 1: Primary info */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="space-y-1">
                    <p className="text-[11px] text-gray-400 font-medium uppercase tracking-wide">Nome</p>
                    <p className="text-sm font-medium text-gray-900">{data.nome}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[11px] text-gray-400 font-medium uppercase tracking-wide">CNPJ</p>
                    <p className="text-sm text-gray-900 tabular-nums">{data.cnpj || "—"}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[11px] text-gray-400 font-medium uppercase tracking-wide">Razão Social</p>
                    <p className="text-sm text-gray-900">{data.razaoSocial}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[11px] text-gray-400 font-medium uppercase tracking-wide">Responsável</p>
                    <p className="text-sm text-gray-900 flex items-center gap-1.5">
                      <User className="h-3.5 w-3.5 text-gray-300" aria-hidden="true" />
                      {data.responsavel || "—"}
                    </p>
                  </div>
                </div>

                {/* Row 2: Contact info */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 pt-3 border-t border-gray-50">
                  <div className="space-y-1">
                    <p className="text-[11px] text-gray-400 font-medium uppercase tracking-wide">E-mail</p>
                    <p className="text-sm text-gray-900 flex items-center gap-1.5">
                      <Mail className="h-3.5 w-3.5 text-gray-300 shrink-0" aria-hidden="true" />
                      <span className="truncate">{data.email}</span>
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[11px] text-gray-400 font-medium uppercase tracking-wide">Endereço</p>
                    <p className="text-sm text-gray-900 flex items-center gap-1.5">
                      <MapPin className="h-3.5 w-3.5 text-gray-300 shrink-0" aria-hidden="true" />
                      <span className="truncate">{data.endereco || "—"}</span>
                    </p>
                  </div>
                </div>

                {/* Row 3: Contatos */}
                {data.contatos && data.contatos.length > 0 && (
                  <div className="pt-3 border-t border-gray-50">
                    <p className="text-[11px] text-gray-400 font-medium uppercase tracking-wide mb-2">Contatos</p>
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                      {data.contatos.map((c, i) => (
                        <div key={i} className="flex items-center gap-2 text-sm text-gray-900">
                          <User className="h-3.5 w-3.5 text-gray-300 shrink-0" aria-hidden="true" />
                          <div>
                            <span className="font-medium">{c.nome}</span>
                            {c.isPrimario && (
                              <span className="ml-1.5 text-[10px] font-medium text-primary bg-primary/10 px-1.5 py-0.5 rounded-full">
                                Principal
                              </span>
                            )}
                            <p className="text-xs text-gray-500">{c.telefone}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex justify-end pt-1">
                  <Button variant="outline" size="sm" onClick={handleOpenDialog}>
                    <Pencil className="mr-2 h-3.5 w-3.5" />
                    Editar cadastro
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gray-100 mb-3">
                  <Building2 className="h-5 w-5 text-gray-400" aria-hidden="true" />
                </div>
                <p className="text-sm font-medium text-gray-900 mb-1">
                  Nenhuma franqueadora cadastrada
                </p>
                <p className="text-xs text-gray-400 mb-4 max-w-xs">
                  Cadastre os dados da franqueadora para começar a gerenciar seus franqueados.
                </p>
                <Button size="sm" onClick={handleOpenDialog}>
                  <Plus className="mr-2 h-3.5 w-3.5" />
                  Cadastrar franqueadora
                </Button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modal de edição */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent
          className="max-w-2xl max-h-[90vh] overflow-y-auto"
          onInteractOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => e.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle>
              {data ? "Editar Franqueadora" : "Cadastrar Franqueadora"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <p className="text-xs text-gray-500">
              <span className="text-red-500">*</span> Campos obrigatórios
            </p>

            {errors.length > 0 && (
              <div role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700 space-y-1">
                {errors.map((err, i) => (
                  <p key={i}>{err}</p>
                ))}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="fq-nome">
                  Nome <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="fq-nome"
                  name="nome"
                  autoComplete="organization"
                  value={form.nome}
                  onChange={(e) => updateField("nome", e.target.value)}
                  placeholder="Nome da franqueadora…"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="fq-cnpj">CNPJ</Label>
                <Input
                  id="fq-cnpj"
                  name="cnpj"
                  value={form.cnpj}
                  onChange={(e) => updateField("cnpj", e.target.value)}
                  placeholder="00.000.000/0000-00"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="fq-razaoSocial">
                  Razão Social <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="fq-razaoSocial"
                  name="razaoSocial"
                  value={form.razaoSocial}
                  onChange={(e) => updateField("razaoSocial", e.target.value)}
                  placeholder="Razão social…"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="fq-email">
                  E-mail <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="fq-email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  spellCheck={false}
                  value={form.email}
                  onChange={(e) => updateField("email", e.target.value)}
                  placeholder="email@exemplo.com"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="fq-emailSecundario">E-mail secundário</Label>
                <Input
                  id="fq-emailSecundario"
                  name="emailSecundario"
                  type="email"
                  spellCheck={false}
                  value={form.emailSecundario}
                  onChange={(e) => updateField("emailSecundario", e.target.value)}
                  placeholder="email@exemplo.com"
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="fq-endereco">Endereço</Label>
                <Input
                  id="fq-endereco"
                  name="endereco"
                  autoComplete="street-address"
                  value={form.endereco}
                  onChange={(e) => updateField("endereco", e.target.value)}
                  placeholder="Endereço completo…"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="fq-responsavel">Responsável</Label>
                <Input
                  id="fq-responsavel"
                  name="responsavel"
                  autoComplete="name"
                  value={form.responsavel}
                  onChange={(e) => updateField("responsavel", e.target.value)}
                  placeholder="Nome do responsável…"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="fq-celular">Celular</Label>
                <Input
                  id="fq-celular"
                  name="celular"
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  value={form.celular}
                  onChange={(e) => updateField("celular", e.target.value)}
                  placeholder="(00) 00000-0000"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="fq-celularSecundario">Celular secundário</Label>
                <Input
                  id="fq-celularSecundario"
                  name="celularSecundario"
                  type="tel"
                  inputMode="tel"
                  value={form.celularSecundario}
                  onChange={(e) => updateField("celularSecundario", e.target.value)}
                  placeholder="(00) 00000-0000"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="fq-telefone">Telefone</Label>
                <Input
                  id="fq-telefone"
                  name="telefone"
                  type="tel"
                  inputMode="tel"
                  value={form.telefone}
                  onChange={(e) => updateField("telefone", e.target.value)}
                  placeholder="(00) 0000-0000"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="fq-telefoneSecundario">Telefone secundário</Label>
                <Input
                  id="fq-telefoneSecundario"
                  name="telefoneSecundario"
                  type="tel"
                  inputMode="tel"
                  value={form.telefoneSecundario}
                  onChange={(e) => updateField("telefoneSecundario", e.target.value)}
                  placeholder="(00) 0000-0000"
                />
              </div>
            </div>

            {/* Contatos */}
            <div className="space-y-3 pt-2 border-t border-gray-100">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium text-gray-700">Contatos</Label>
                <button
                  type="button"
                  onClick={() => setContatos((prev) => [...prev, { nome: "", telefone: "", isPrimario: prev.length === 0 }])}
                  className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:text-primary-hover transition-colors"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Adicionar contato
                </button>
              </div>

              {contatos.length === 0 && (
                <p className="text-xs text-gray-400">Nenhum contato adicionado.</p>
              )}

              {contatos.map((contato, idx) => (
                <div key={idx} className="flex items-start gap-2">
                  <div className="flex-1 grid grid-cols-2 gap-2">
                    <Input
                      value={contato.nome}
                      onChange={(e) => {
                        const updated = [...contatos];
                        updated[idx] = { ...updated[idx], nome: e.target.value };
                        setContatos(updated);
                      }}
                      placeholder="Nome do contato…"
                    />
                    <Input
                      type="tel"
                      inputMode="tel"
                      value={contato.telefone}
                      onChange={(e) => {
                        const updated = [...contatos];
                        updated[idx] = { ...updated[idx], telefone: e.target.value };
                        setContatos(updated);
                      }}
                      placeholder="(00) 00000-0000"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const wasPrimario = contatos[idx].isPrimario;
                      const updated = contatos.filter((_, i) => i !== idx);
                      // Se removeu o primário, marcar o primeiro como primário
                      if (wasPrimario && updated.length > 0) {
                        updated[0] = { ...updated[0], isPrimario: true };
                      }
                      setContatos(updated);
                    }}
                    className="mt-2 p-1 text-gray-400 hover:text-red-500 transition-colors"
                    title="Remover contato"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                  {idx === 0 && contatos.length > 0 && (
                    <span className="mt-2 text-[10px] font-medium text-primary bg-primary/10 px-2 py-1 rounded-full whitespace-nowrap">
                      Principal
                    </span>
                  )}
                </div>
              ))}
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setDialogOpen(false)}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={formLoading}>
                {formLoading && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Salvar
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
