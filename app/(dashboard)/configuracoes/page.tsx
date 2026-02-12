"use client";

import { useState, useEffect } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { FranqueadoraCard } from "@/components/franqueadora-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "@/components/ui/use-toast";
import { cn } from "@/lib/cn";
import {
  Building2,
  Receipt,
  Bell,
  Calculator,
  Plug,
  Users,
  Palette,
  Eye,
  EyeOff,
  Mail,
  Shield,
  Phone,
  Loader2,
} from "lucide-react";

/* ───────────────────── Nav items ───────────────────── */

type SettingsTab =
  | "empresa"
  | "cobrancas"
  | "notificacoes"
  | "apuracao"
  | "integracoes"
  | "usuarios"
  | "aparencia";

const tabs: { id: SettingsTab; label: string; icon: React.ElementType }[] = [
  { id: "empresa", label: "Dados da empresa", icon: Building2 },
  { id: "cobrancas", label: "Cobranças", icon: Receipt },
  { id: "notificacoes", label: "Notificações", icon: Bell },
  { id: "apuracao", label: "Apuração", icon: Calculator },
  { id: "integracoes", label: "Integrações", icon: Plug },
  { id: "usuarios", label: "Usuários e acesso", icon: Users },
  { id: "aparencia", label: "Aparência", icon: Palette },
];

/* ───────────────────── Seção: Cobranças ───────────────────── */

function CobrancaContent() {
  const [vencimento, setVencimento] = useState("D+15");
  const [juros, setJuros] = useState("1.0");
  const [multa, setMulta] = useState("2.0");
  const [formaPagamento, setFormaPagamento] = useState("boleto_pix");
  const [textoBoleto, setTextoBoleto] = useState(
    "Após o vencimento, cobrar juros de 1% ao mês e multa de 2%."
  );

  const handleSave = () => {
    toast({
      title: "Preferências salvas",
      description: "As configurações de cobrança foram atualizadas.",
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">Preferências de Cobrança</h2>
        <p className="text-sm text-gray-500 mt-1">Configure valores padrão para novas cobranças.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <div className="space-y-2">
          <Label htmlFor="vencimento">Vencimento padrão</Label>
          <Select value={vencimento} onValueChange={setVencimento}>
            <SelectTrigger id="vencimento"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="D+10">D+10</SelectItem>
              <SelectItem value="D+15">D+15</SelectItem>
              <SelectItem value="D+20">D+20</SelectItem>
              <SelectItem value="D+30">D+30</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="forma-pagamento">Forma de pagamento padrão</Label>
          <Select value={formaPagamento} onValueChange={setFormaPagamento}>
            <SelectTrigger id="forma-pagamento"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="boleto">Boleto</SelectItem>
              <SelectItem value="pix">Pix</SelectItem>
              <SelectItem value="boleto_pix">Boleto + Pix</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="juros">Juros ao mês (%)</Label>
          <Input id="juros" type="number" step="0.1" min="0" value={juros} onChange={(e) => setJuros(e.target.value)} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="multa">Multa por atraso (%)</Label>
          <Input id="multa" type="number" step="0.1" min="0" value={multa} onChange={(e) => setMulta(e.target.value)} />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="texto-boleto">Texto padrão do boleto</Label>
        <Textarea id="texto-boleto" value={textoBoleto} onChange={(e) => setTextoBoleto(e.target.value)} rows={3} />
      </div>

      <div className="flex justify-end">
        <Button onClick={handleSave}>Salvar</Button>
      </div>
    </div>
  );
}

/* ───────────────────── Seção: Notificações ───────────────────── */

function NotificacoesContent() {
  const [emailAtivo, setEmailAtivo] = useState(true);
  const [smsAtivo, setSmsAtivo] = useState(false);
  const [whatsappAtivo, setWhatsappAtivo] = useState(true);
  const [horarioEnvio, setHorarioEnvio] = useState("08h-20h");
  const [remetente, setRemetente] = useState("");
  const [assinatura, setAssinatura] = useState("");

  const handleSave = () => {
    toast({
      title: "Preferências salvas",
      description: "As configurações de notificações foram atualizadas.",
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">Notificações</h2>
        <p className="text-sm text-gray-500 mt-1">Gerencie canais e horários de envio.</p>
      </div>

      <div>
        <p className="text-xs text-gray-500 font-medium uppercase tracking-wide mb-3">Canais ativos</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="flex items-center justify-between rounded-xl border border-gray-200 px-4 py-3">
            <Label htmlFor="switch-email" className="cursor-pointer">Email</Label>
            <Switch id="switch-email" checked={emailAtivo} onCheckedChange={setEmailAtivo} />
          </div>
          <div className="flex items-center justify-between rounded-xl border border-gray-200 px-4 py-3">
            <Label htmlFor="switch-sms" className="cursor-pointer">SMS</Label>
            <Switch id="switch-sms" checked={smsAtivo} onCheckedChange={setSmsAtivo} />
          </div>
          <div className="flex items-center justify-between rounded-xl border border-gray-200 px-4 py-3">
            <Label htmlFor="switch-whatsapp" className="cursor-pointer">WhatsApp</Label>
            <Switch id="switch-whatsapp" checked={whatsappAtivo} onCheckedChange={setWhatsappAtivo} />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <div className="space-y-2">
          <Label htmlFor="horario-envio">Horário de envio</Label>
          <Select value={horarioEnvio} onValueChange={setHorarioEnvio}>
            <SelectTrigger id="horario-envio"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="06h-20h">06h - 20h</SelectItem>
              <SelectItem value="08h-20h">08h - 20h</SelectItem>
              <SelectItem value="08h-18h">08h - 18h</SelectItem>
              <SelectItem value="24h">24h (sem restrição)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="remetente-email">Remetente de e-mail</Label>
          <Input id="remetente-email" value={remetente} onChange={(e) => setRemetente(e.target.value)} placeholder="nome@suaempresa.com" />
        </div>

        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="assinatura">Assinatura padrão</Label>
          <Input id="assinatura" value={assinatura} onChange={(e) => setAssinatura(e.target.value)} placeholder="Rodapé das mensagens enviadas" />
        </div>
      </div>

      <div className="flex justify-end">
        <Button onClick={handleSave}>Salvar</Button>
      </div>
    </div>
  );
}

/* ───────────────────── Seção: Apuração ───────────────────── */

function ApuracaoContent() {
  const [royalties, setRoyalties] = useState("5");
  const [fnp, setFnp] = useState("2");
  const [baseCalculo, setBaseCalculo] = useState("bruto");
  const [diaFechamento, setDiaFechamento] = useState("25");
  const [nfRoyalties, setNfRoyalties] = useState(false);
  const [nfFnp, setNfFnp] = useState(false);

  const handleSave = () => {
    toast({
      title: "Preferências salvas",
      description: "As configurações de apuração foram atualizadas.",
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">Apuração</h2>
        <p className="text-sm text-gray-500 mt-1">Configure royalties, FNP e fechamento mensal.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <div className="space-y-2">
          <Label htmlFor="royalties">Royalties (%)</Label>
          <Input id="royalties" type="number" step="0.1" min="0" value={royalties} onChange={(e) => setRoyalties(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="fnp">FNP / Marketing (%)</Label>
          <Input id="fnp" type="number" step="0.1" min="0" value={fnp} onChange={(e) => setFnp(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="base-calculo">Base de cálculo</Label>
          <Select value={baseCalculo} onValueChange={setBaseCalculo}>
            <SelectTrigger id="base-calculo"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="bruto">Bruto</SelectItem>
              <SelectItem value="liquido">Líquido</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="dia-fechamento">Dia de fechamento</Label>
          <Select value={diaFechamento} onValueChange={setDiaFechamento}>
            <SelectTrigger id="dia-fechamento"><SelectValue /></SelectTrigger>
            <SelectContent>
              {Array.from({ length: 28 }, (_, i) => (
                <SelectItem key={i + 1} value={String(i + 1)}>Dia {i + 1}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div>
        <p className="text-xs text-gray-500 font-medium uppercase tracking-wide mb-3">Emissão automática de NF</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="flex items-center justify-between rounded-xl border border-gray-200 px-4 py-3">
            <Label htmlFor="switch-nf-royalties" className="cursor-pointer">Royalties</Label>
            <Switch id="switch-nf-royalties" checked={nfRoyalties} onCheckedChange={setNfRoyalties} />
          </div>
          <div className="flex items-center justify-between rounded-xl border border-gray-200 px-4 py-3">
            <Label htmlFor="switch-nf-fnp" className="cursor-pointer">FNP / Marketing</Label>
            <Switch id="switch-nf-fnp" checked={nfFnp} onCheckedChange={setNfFnp} />
          </div>
        </div>
      </div>

      <div className="flex justify-end">
        <Button onClick={handleSave}>Salvar</Button>
      </div>
    </div>
  );
}

/* ───────────────────── Seção: Integrações ───────────────────── */

function TwilioNumbersSection() {
  const [whatsappFrom, setWhatsappFrom] = useState("");
  const [smsFrom, setSmsFrom] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/agent-config/twilio")
      .then((res) => res.json())
      .then((data) => {
        setWhatsappFrom(data.whatsappFrom || "");
        setSmsFrom(data.smsFrom || "");
      })
      .catch(() => {
        toast({ title: "Erro", description: "Não foi possível carregar os números Twilio.", variant: "destructive" });
      })
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/agent-config/twilio", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ whatsappFrom, smsFrom }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Erro ao salvar");
      }
      const data = await res.json();
      setWhatsappFrom(data.whatsappFrom || "");
      setSmsFrom(data.smsFrom || "");
      toast({ title: "Salvo", description: "Números Twilio atualizados com sucesso." });
    } catch (err) {
      toast({
        title: "Erro",
        description: err instanceof Error ? err.message : "Não foi possível salvar.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-gray-500 py-4">
        <Loader2 className="h-4 w-4 animate-spin" />
        Carregando...
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs text-gray-500 font-medium uppercase tracking-wide mb-3">
          Twilio — Números de envio
        </p>
        <p className="text-sm text-gray-500 mb-4">
          Configure os números de WhatsApp e SMS desta franqueadora. Se não configurados, serão usados os números padrão do sistema.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="twilio-whatsapp" className="flex items-center gap-2">
            <Phone className="h-4 w-4 text-gray-400" />
            Número WhatsApp
          </Label>
          <Input
            id="twilio-whatsapp"
            value={whatsappFrom}
            onChange={(e) => setWhatsappFrom(e.target.value)}
            placeholder="whatsapp:+5511999999999"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="twilio-sms" className="flex items-center gap-2">
            <Phone className="h-4 w-4 text-gray-400" />
            Número SMS
          </Label>
          <Input
            id="twilio-sms"
            value={smsFrom}
            onChange={(e) => setSmsFrom(e.target.value)}
            placeholder="+5511999999999"
          />
        </div>
      </div>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving}>
          {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
          Salvar números
        </Button>
      </div>
    </div>
  );
}

function IntegracoesContent() {
  const [apiKey, setApiKey] = useState("");
  const [showApiKey, setShowApiKey] = useState(false);
  const [webhookUrl, setWebhookUrl] = useState("");

  const fontes = [
    { nome: "PDV", conectado: true },
    { nome: "iFood", conectado: true },
    { nome: "Rappi", conectado: false },
    { nome: "Outras", conectado: false },
  ];

  const handleSave = () => {
    toast({
      title: "Preferências salvas",
      description: "As configurações de integrações foram atualizadas.",
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">Integrações</h2>
        <p className="text-sm text-gray-500 mt-1">Conecte APIs e fontes de dados externas.</p>
      </div>

      <TwilioNumbersSection />

      <hr className="border-gray-100" />

      <div className="space-y-2">
        <Label htmlFor="api-key">Chave API Anthropic</Label>
        <div className="relative">
          <Input
            id="api-key"
            type={showApiKey ? "text" : "password"}
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="sk-ant-..."
            className="pr-10"
          />
          <button
            type="button"
            onClick={() => setShowApiKey((v) => !v)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
      </div>

      <div>
        <p className="text-xs text-gray-500 font-medium uppercase tracking-wide mb-3">Fontes de dados</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {fontes.map((fonte) => (
            <div key={fonte.nome} className="flex items-center justify-between rounded-xl border border-gray-200 px-4 py-3">
              <span className="text-sm text-gray-700">{fonte.nome}</span>
              <Badge className={fonte.conectado ? "bg-emerald-50 text-emerald-700 border-transparent" : "bg-gray-50 text-gray-500 border-transparent"}>
                {fonte.conectado ? "Conectado" : "Off"}
              </Badge>
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="webhook-url">Webhook URL</Label>
        <Input id="webhook-url" value={webhookUrl} onChange={(e) => setWebhookUrl(e.target.value)} placeholder="https://sua-api.com/webhook" />
      </div>

      <div className="flex justify-end">
        <Button onClick={handleSave}>Salvar</Button>
      </div>
    </div>
  );
}

/* ───────────────────── Seção: Usuários ───────────────────── */

function UsuariosContent() {
  const [usuarios] = useState([
    { nome: "Victor S.", email: "victor@menlo.com.br", perfil: "Administrador", status: "Ativo" },
  ]);
  const [conviteEmail, setConviteEmail] = useState("");
  const [convitePerfil, setConvitePerfil] = useState("Administrador");

  const handleConvite = () => {
    toast({
      title: "Convite enviado",
      description: `Convite enviado para ${conviteEmail || "o email informado"}.`,
    });
    setConviteEmail("");
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">Usuários e Acesso</h2>
        <p className="text-sm text-gray-500 mt-1">Gerencie membros da equipe e permissões.</p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="text-left py-2.5 pr-4 text-xs font-medium text-gray-500 uppercase tracking-wide">Nome</th>
              <th className="text-left py-2.5 pr-4 text-xs font-medium text-gray-500 uppercase tracking-wide">Email</th>
              <th className="text-left py-2.5 pr-4 text-xs font-medium text-gray-500 uppercase tracking-wide">Perfil</th>
              <th className="text-left py-2.5 pr-4 text-xs font-medium text-gray-500 uppercase tracking-wide">Status</th>
              <th className="py-2.5" />
            </tr>
          </thead>
          <tbody>
            {usuarios.map((u) => (
              <tr key={u.email} className="border-b border-gray-50">
                <td className="py-3 pr-4 text-gray-900 font-medium">{u.nome}</td>
                <td className="py-3 pr-4 text-gray-600">{u.email}</td>
                <td className="py-3 pr-4">
                  <Badge className="bg-purple-50 text-purple-700 border-transparent gap-1">
                    <Shield className="h-3 w-3" />{u.perfil}
                  </Badge>
                </td>
                <td className="py-3 pr-4">
                  <Badge className="bg-emerald-50 text-emerald-700 border-transparent">{u.status}</Badge>
                </td>
                <td className="py-3 text-right">
                  <Button variant="ghost" size="sm" className="text-gray-400 hover:text-gray-600">Editar</Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="space-y-3 pt-2">
        <Label className="flex items-center gap-2">
          <Mail className="h-4 w-4 text-gray-400" />Convidar usuário
        </Label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input type="email" placeholder="email@exemplo.com" value={conviteEmail} onChange={(e) => setConviteEmail(e.target.value)} />
          <Select value={convitePerfil} onValueChange={setConvitePerfil}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="Administrador">Administrador</SelectItem>
              <SelectItem value="Financeiro">Financeiro</SelectItem>
              <SelectItem value="Operacional">Operacional</SelectItem>
              <SelectItem value="Visualizador">Visualizador</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex justify-end">
          <Button onClick={handleConvite}>Enviar convite</Button>
        </div>
      </div>
    </div>
  );
}

/* ───────────────────── Seção: Aparência ───────────────────── */

function AparenciaContent() {
  const [tema, setTema] = useState<"claro" | "escuro" | "sistema">("claro");
  const [densidade, setDensidade] = useState("confortavel");
  const [sidebarRecolhida, setSidebarRecolhida] = useState(false);

  const temaOptions: { value: "claro" | "escuro" | "sistema"; label: string }[] = [
    { value: "claro", label: "Claro" },
    { value: "escuro", label: "Escuro" },
    { value: "sistema", label: "Sistema" },
  ];

  const handleSave = () => {
    toast({
      title: "Preferências salvas",
      description: "As configurações de aparência foram atualizadas.",
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">Aparência</h2>
        <p className="text-sm text-gray-500 mt-1">Personalize o visual da plataforma.</p>
      </div>

      <div className="space-y-2">
        <Label>Tema</Label>
        <div className="inline-flex rounded-lg border border-gray-200 p-1">
          {temaOptions.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setTema(opt.value)}
              className={cn(
                "px-4 py-1.5 text-sm font-medium rounded-md transition-colors",
                tema === opt.value ? "bg-gray-100 text-gray-900" : "text-gray-500 hover:text-gray-700"
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <div className="space-y-2">
          <Label htmlFor="densidade">Densidade da interface</Label>
          <Select value={densidade} onValueChange={setDensidade}>
            <SelectTrigger id="densidade"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="confortavel">Confortável</SelectItem>
              <SelectItem value="compacto">Compacto</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex items-center justify-between rounded-xl border border-gray-200 px-4 py-3 max-w-md">
        <Label htmlFor="switch-sidebar" className="cursor-pointer">Sidebar recolhida por padrão</Label>
        <Switch id="switch-sidebar" checked={sidebarRecolhida} onCheckedChange={setSidebarRecolhida} />
      </div>

      <div className="flex justify-end">
        <Button onClick={handleSave}>Salvar</Button>
      </div>
    </div>
  );
}

/* ───────────────────── Página Principal ───────────────────── */

export default function ConfiguracoesPage() {
  const [activeTab, setActiveTab] = useState<SettingsTab>("empresa");

  const renderContent = () => {
    switch (activeTab) {
      case "empresa":
        return <FranqueadoraCard />;
      case "cobrancas":
        return <CobrancaContent />;
      case "notificacoes":
        return <NotificacoesContent />;
      case "apuracao":
        return <ApuracaoContent />;
      case "integracoes":
        return <IntegracoesContent />;
      case "usuarios":
        return <UsuariosContent />;
      case "aparencia":
        return <AparenciaContent />;
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Configurações"
        subtitle="Gerencie preferências da sua operação"
      />

      <div className="flex gap-6">
        {/* Sidebar navigation */}
        <nav className="w-56 flex-shrink-0">
          <div className="bg-white rounded-2xl border border-gray-100 p-2">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    "flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm font-medium transition-colors text-left",
                    isActive
                      ? "bg-gray-100 text-gray-900"
                      : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                  )}
                >
                  <Icon
                    className={cn(
                      "h-4 w-4 flex-shrink-0",
                      isActive ? "text-gray-900" : "text-gray-400"
                    )}
                    strokeWidth={1.5}
                  />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </nav>

        {/* Content area */}
        <div className="flex-1 min-w-0">
          <div className="bg-white rounded-2xl border border-gray-100 p-8">
            {renderContent()}
          </div>
        </div>
      </div>
    </div>
  );
}
