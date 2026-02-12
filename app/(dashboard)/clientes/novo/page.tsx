"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { useToast } from "@/components/ui/use-toast";
import { cn } from "@/lib/cn";

export default function NovoClientePage() {
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState({
    name: "",
    doc: "",
    email: "",
    phone: "",
    razaoSocial: "",
    cidade: "",
    estado: "",
    bairro: "",
    responsavel: "",
    statusLoja: "Aberta",
  });

  function updateField(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    try {
      const res = await fetch("/api/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      if (!res.ok) {
        const data = await res.json();
        const msg = data.errors?.join(", ") || data.error || "Erro ao cadastrar";
        toast({ title: "Erro", description: msg, variant: "destructive" });
        setLoading(false);
        return;
      }

      toast({ title: "Sucesso", description: "Franqueado cadastrado com sucesso!" });
      router.push("/clientes");
    } catch {
      toast({ title: "Erro", description: "Erro de conexão. Tente novamente.", variant: "destructive" });
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <Breadcrumbs
        items={[
          { label: "Franqueados", href: "/clientes" },
          { label: "Novo Franqueado" },
        ]}
      />

      <div className="bg-white rounded-2xl border border-gray-100 shadow-soft overflow-hidden">
        <div className="px-6 py-5 border-b border-gray-100">
          <h1 className="text-lg font-semibold text-gray-900">Novo Franqueado</h1>
          <p className="text-sm text-gray-500 mt-0.5">Preencha os dados do franqueado</p>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Dados obrigatórios */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field
              label="Nome *"
              value={form.name}
              onChange={(v) => updateField("name", v)}
              placeholder="Nome do franqueado"
              required
            />
            <Field
              label="CPF/CNPJ *"
              value={form.doc}
              onChange={(v) => updateField("doc", v)}
              placeholder="000.000.000-00"
              required
            />
            <Field
              label="E-mail *"
              type="email"
              value={form.email}
              onChange={(v) => updateField("email", v)}
              placeholder="email@exemplo.com"
              required
            />
            <Field
              label="Telefone *"
              value={form.phone}
              onChange={(v) => updateField("phone", v)}
              placeholder="(00) 00000-0000"
              required
            />
          </div>

          {/* Dados opcionais */}
          <div>
            <h3 className="text-sm font-medium text-gray-700 mb-3">Dados complementares</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field
                label="Razão Social"
                value={form.razaoSocial}
                onChange={(v) => updateField("razaoSocial", v)}
                placeholder="Razão social da empresa"
              />
              <Field
                label="Responsável"
                value={form.responsavel}
                onChange={(v) => updateField("responsavel", v)}
                placeholder="Nome do responsável"
              />
              <Field
                label="Cidade"
                value={form.cidade}
                onChange={(v) => updateField("cidade", v)}
                placeholder="Cidade"
              />
              <Field
                label="Estado"
                value={form.estado}
                onChange={(v) => updateField("estado", v)}
                placeholder="UF"
              />
              <Field
                label="Bairro"
                value={form.bairro}
                onChange={(v) => updateField("bairro", v)}
                placeholder="Bairro"
              />
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-gray-700">Status da Loja</label>
                <select
                  value={form.statusLoja}
                  onChange={(e) => updateField("statusLoja", e.target.value)}
                  className="block w-full rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm text-gray-900 transition-all focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                >
                  <option value="Aberta">Aberta</option>
                  <option value="Fechada">Fechada</option>
                  <option value="Vendida">Vendida</option>
                </select>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => router.push("/clientes")}
              className="px-4 py-2.5 text-sm font-medium text-gray-700 border border-gray-300 rounded-xl hover:bg-gray-50 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2.5 text-sm font-medium text-white bg-primary rounded-xl hover:bg-primary/90 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading ? "Cadastrando..." : "Cadastrar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  required = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  required?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <label className="block text-sm font-medium text-gray-700">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        className="block w-full rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 transition-all focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
      />
    </div>
  );
}
