"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/use-toast";
import {
  ArrowLeft,
  Plus,
  Loader2,
  Trash2,
  Pencil,
} from "lucide-react";
import {
  TEMPLATE_PRESETS,
  CHANNEL_LABELS,
  CHANNEL_COLORS,
  TRIGGER_LABELS,
} from "@/lib/utils";

interface DunningStep {
  id: string;
  trigger: string;
  offsetDays: number;
  channel: string;
  template: string;
  enabled: boolean;
}

interface DunningRule {
  id: string;
  name: string;
  active: boolean;
  timezone: string;
  createdAt: string;
  steps: DunningStep[];
}

export default function ReguaDetalhePage() {
  const params = useParams();
  const router = useRouter();
  const [rule, setRule] = useState<DunningRule | null>(null);
  const [loading, setLoading] = useState(true);
  const [stepDialogOpen, setStepDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [formLoading, setFormLoading] = useState(false);
  const [editingStep, setEditingStep] = useState<DunningStep | null>(null);
  const [stepFormData, setStepFormData] = useState({
    trigger: "BEFORE_DUE",
    offsetDays: "5",
    channel: "EMAIL",
    template: "",
  });

  const fetchRule = async () => {
    try {
      const res = await fetch(`/api/dunning-rules/${params.id}`);
      if (!res.ok) throw new Error("Rule not found");
      const data = await res.json();
      setRule(data);
    } catch (error) {
      toast({
        title: "Erro",
        description: "Régua não encontrada",
        variant: "destructive",
      });
      router.push("/reguas");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRule();
  }, [params.id]);

  const toggleActive = async (active: boolean) => {
    try {
      const res = await fetch(`/api/dunning-rules/${params.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active }),
      });

      if (!res.ok) throw new Error("Failed to update");

      toast({
        title: active ? "Régua ativada!" : "Régua desativada!",
      });

      fetchRule();
    } catch (error) {
      toast({
        title: "Erro",
        description: "Falha ao atualizar régua",
        variant: "destructive",
      });
    }
  };

  const handleDelete = async () => {
    try {
      const res = await fetch(`/api/dunning-rules/${params.id}`, {
        method: "DELETE",
      });

      if (!res.ok) throw new Error("Failed to delete");

      toast({
        title: "Régua excluída!",
        description: "A régua foi removida com sucesso.",
      });

      router.push("/reguas");
    } catch (error) {
      toast({
        title: "Erro",
        description: "Falha ao excluir régua",
        variant: "destructive",
      });
    }
  };

  const handleCreateStep = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormLoading(true);
    try {
      const res = await fetch("/api/dunning-steps", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ruleId: params.id,
          ...stepFormData,
          offsetDays: parseInt(stepFormData.offsetDays),
        }),
      });

      if (!res.ok) throw new Error("Failed to create step");

      toast({
        title: "Step criado!",
        description: "O step foi adicionado à régua.",
      });

      setStepDialogOpen(false);
      resetStepForm();
      fetchRule();
    } catch (error) {
      toast({
        title: "Erro",
        description: "Falha ao criar step",
        variant: "destructive",
      });
    } finally {
      setFormLoading(false);
    }
  };

  const handleUpdateStep = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStep) return;
    setFormLoading(true);
    try {
      const res = await fetch(`/api/dunning-steps/${editingStep.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...stepFormData,
          offsetDays: parseInt(stepFormData.offsetDays),
        }),
      });

      if (!res.ok) throw new Error("Failed to update step");

      toast({
        title: "Step atualizado!",
      });

      setEditDialogOpen(false);
      setEditingStep(null);
      resetStepForm();
      fetchRule();
    } catch (error) {
      toast({
        title: "Erro",
        description: "Falha ao atualizar step",
        variant: "destructive",
      });
    } finally {
      setFormLoading(false);
    }
  };

  const handleDeleteStep = async (stepId: string) => {
    try {
      const res = await fetch(`/api/dunning-steps/${stepId}`, {
        method: "DELETE",
      });

      if (!res.ok) throw new Error("Failed to delete step");

      toast({
        title: "Step excluído!",
      });

      fetchRule();
    } catch (error) {
      toast({
        title: "Erro",
        description: "Falha ao excluir step",
        variant: "destructive",
      });
    }
  };

  const toggleStepEnabled = async (stepId: string, enabled: boolean) => {
    try {
      const res = await fetch(`/api/dunning-steps/${stepId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled }),
      });

      if (!res.ok) throw new Error("Failed to update step");

      fetchRule();
    } catch (error) {
      toast({
        title: "Erro",
        description: "Falha ao atualizar step",
        variant: "destructive",
      });
    }
  };

  const resetStepForm = () => {
    setStepFormData({
      trigger: "BEFORE_DUE",
      offsetDays: "5",
      channel: "EMAIL",
      template: "",
    });
  };

  const openEditDialog = (step: DunningStep) => {
    setEditingStep(step);
    setStepFormData({
      trigger: step.trigger,
      offsetDays: step.offsetDays.toString(),
      channel: step.channel,
      template: step.template,
    });
    setEditDialogOpen(true);
  };

  const applyPreset = (presetId: string) => {
    const preset = TEMPLATE_PRESETS.find((p) => p.id === presetId);
    if (preset) {
      setStepFormData({
        ...stepFormData,
        trigger: preset.trigger,
        offsetDays: preset.offsetDays.toString(),
        channel: preset.channel,
        template: preset.template,
      });
    }
  };

  const formatStepLabel = (step: DunningStep) => {
    if (step.trigger === "BEFORE_DUE") return `D-${step.offsetDays}`;
    if (step.trigger === "ON_DUE") return "D0";
    if (step.trigger === "AFTER_DUE") return `D+${step.offsetDays}`;
    return "";
  };

  const sortedSteps = rule?.steps.sort((a, b) => {
    const getOrder = (s: DunningStep) => {
      if (s.trigger === "BEFORE_DUE") return -s.offsetDays;
      if (s.trigger === "ON_DUE") return 0;
      if (s.trigger === "AFTER_DUE") return s.offsetDays;
      return 0;
    };
    return getOrder(a) - getOrder(b);
  });

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (!rule) return null;

  const StepForm = ({ onSubmit, isEdit = false }: { onSubmit: (e: React.FormEvent) => void; isEdit?: boolean }) => (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label>Modelos prontos</Label>
        <Select onValueChange={applyPreset}>
          <SelectTrigger>
            <SelectValue placeholder="Selecione um modelo" />
          </SelectTrigger>
          <SelectContent>
            {TEMPLATE_PRESETS.map((preset) => (
              <SelectItem key={preset.id} value={preset.id}>
                {preset.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <Separator />
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Gatilho</Label>
          <Select
            value={stepFormData.trigger}
            onValueChange={(value) =>
              setStepFormData({ ...stepFormData, trigger: value })
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="BEFORE_DUE">Antes do vencimento</SelectItem>
              <SelectItem value="ON_DUE">No vencimento</SelectItem>
              <SelectItem value="AFTER_DUE">Após vencimento</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Dias (offset)</Label>
          <Input
            name="offsetDays"
            type="number"
            inputMode="numeric"
            min="0"
            value={stepFormData.offsetDays}
            onChange={(e) =>
              setStepFormData({ ...stepFormData, offsetDays: e.target.value })
            }
            disabled={stepFormData.trigger === "ON_DUE"}
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label>Canal</Label>
        <Select
          value={stepFormData.channel}
          onValueChange={(value) =>
            setStepFormData({ ...stepFormData, channel: value })
          }
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="EMAIL">E-mail</SelectItem>
            <SelectItem value="SMS">SMS</SelectItem>
            <SelectItem value="WHATSAPP">WhatsApp</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label>Template da mensagem</Label>
        <Textarea
          value={stepFormData.template}
          onChange={(e) =>
            setStepFormData({ ...stepFormData, template: e.target.value })
          }
          placeholder="Use variáveis: {{nome}}, {{valor}}, {{vencimento}}, {{link_boleto}}, {{descricao}}"
          rows={6}
          required
        />
        <p className="text-xs text-muted-foreground">
          Variáveis disponíveis: {"{{nome}}"}, {"{{valor}}"}, {"{{vencimento}}"}, {"{{link_boleto}}"}, {"{{descricao}}"}
        </p>
      </div>
      <DialogFooter>
        <Button type="submit" disabled={formLoading}>
          {formLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {isEdit ? "Salvar" : "Criar"}
        </Button>
      </DialogFooter>
    </form>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/reguas" aria-label="Voltar para réguas">
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          </Link>
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">{rule.name}</h1>
          <p className="text-muted-foreground">Timezone: {rule.timezone}</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Label>Ativa</Label>
            <Switch
              checked={rule.active}
              onCheckedChange={toggleActive}
            />
          </div>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" size="icon" aria-label="Excluir régua">
                <Trash2 className="h-4 w-4 text-red-500" aria-hidden="true" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Excluir régua?</AlertDialogTitle>
                <AlertDialogDescription>
                  Esta ação não pode ser desfeita. Todos os steps serão excluídos.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleDelete}
                  className="bg-red-600 hover:bg-red-700"
                >
                  Excluir
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Steps da Régua</CardTitle>
          <Dialog open={stepDialogOpen} onOpenChange={setStepDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={resetStepForm}>
                <Plus className="mr-2 h-4 w-4" />
                Adicionar step
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Novo Step</DialogTitle>
              </DialogHeader>
              <StepForm onSubmit={handleCreateStep} />
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          {sortedSteps && sortedSteps.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Dia</TableHead>
                  <TableHead>Gatilho</TableHead>
                  <TableHead>Canal</TableHead>
                  <TableHead>Template</TableHead>
                  <TableHead>Ativo</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedSteps.map((step) => (
                  <TableRow key={step.id}>
                    <TableCell className="font-mono font-bold">
                      {formatStepLabel(step)}
                    </TableCell>
                    <TableCell>{TRIGGER_LABELS[step.trigger]}</TableCell>
                    <TableCell>
                      <Badge className={CHANNEL_COLORS[step.channel]}>
                        {CHANNEL_LABELS[step.channel]}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-xs truncate">
                      {step.template.substring(0, 50)}&hellip;
                    </TableCell>
                    <TableCell>
                      <Switch
                        checked={step.enabled}
                        onCheckedChange={(checked) =>
                          toggleStepEnabled(step.id, checked)
                        }
                      />
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label="Editar step"
                          onClick={() => openEditDialog(step)}
                        >
                          <Pencil className="h-4 w-4" aria-hidden="true" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon" aria-label="Excluir step">
                              <Trash2 className="h-4 w-4 text-red-500" aria-hidden="true" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Excluir step?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Esta ação não pode ser desfeita.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handleDeleteStep(step.id)}
                                className="bg-red-600 hover:bg-red-700"
                              >
                                Excluir
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="py-8 text-center text-muted-foreground">
              Nenhum step adicionado. Adicione steps para configurar a régua.
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Editar Step</DialogTitle>
          </DialogHeader>
          <StepForm onSubmit={handleUpdateStep} isEdit />
        </DialogContent>
      </Dialog>
    </div>
  );
}
