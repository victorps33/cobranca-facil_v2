"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import { toast } from "@/components/ui/use-toast";
import {
  ArrowLeft,
  Loader2,
  CheckCircle,
  XCircle,
  RotateCcw,
  FileText,
  Copy,
  ExternalLink,
  Printer,
  Barcode,
} from "lucide-react";
import {
  formatCurrency,
  formatDate,
  formatDateTime,
  STATUS_LABELS,
  STATUS_COLORS,
  CHANNEL_LABELS,
  CHANNEL_COLORS,
  NOTIFICATION_STATUS_LABELS,
  NOTIFICATION_STATUS_COLORS,
} from "@/lib/utils";

interface Charge {
  id: string;
  description: string;
  amountCents: number;
  dueDate: string;
  status: string;
  createdAt: string;
  customer: {
    id: string;
    name: string;
    email: string;
    doc: string;
  };
  boleto: {
    id: string;
    linhaDigitavel: string;
    barcodeValue: string;
    publicUrl: string;
  } | null;
  notificationLogs: Array<{
    id: string;
    channel: string;
    status: string;
    scheduledFor: string;
    sentAt: string | null;
    renderedMessage: string;
    step: {
      trigger: string;
      offsetDays: number;
    };
  }>;
}

export default function CobrancaDetalhePage() {
  const params = useParams();
  const router = useRouter();
  const [charge, setCharge] = useState<Charge | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchCharge = async () => {
    try {
      const res = await fetch(`/api/charges/${params.id}`);
      if (!res.ok) throw new Error("Charge not found");
      const data = await res.json();
      setCharge(data);
    } catch (error) {
      toast({
        title: "Erro",
        description: "Cobrança não encontrada",
        variant: "destructive",
      });
      router.push("/cobrancas");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCharge();
  }, [params.id]);

  const updateStatus = async (status: string) => {
    setActionLoading(status);
    try {
      const res = await fetch(`/api/charges/${params.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });

      if (!res.ok) throw new Error("Failed to update");

      toast({
        title: "Status atualizado!",
        description: `Cobrança marcada como ${STATUS_LABELS[status].toLowerCase()}.`,
      });

      fetchCharge();
    } catch (error) {
      toast({
        title: "Erro",
        description: "Falha ao atualizar status",
        variant: "destructive",
      });
    } finally {
      setActionLoading(null);
    }
  };

  const generateBoleto = async () => {
    setActionLoading("boleto");
    try {
      const res = await fetch(`/api/charges/${params.id}/generate-boleto`, {
        method: "POST",
      });

      if (!res.ok) throw new Error("Failed to generate boleto");

      toast({
        title: "Boleto gerado!",
        description: "O boleto foi gerado com sucesso.",
      });

      fetchCharge();
    } catch (error) {
      toast({
        title: "Erro",
        description: "Falha ao gerar boleto",
        variant: "destructive",
      });
    } finally {
      setActionLoading(null);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copiado!",
      description: "Linha digitável copiada para a área de transferência.",
    });
  };

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (!charge) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/cobrancas" aria-label="Voltar para cobranças">
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold">{charge.description}</h1>
          <p className="text-muted-foreground">
            {charge.customer.name} • {formatCurrency(charge.amountCents)}
          </p>
        </div>
        <Badge className={`ml-auto ${STATUS_COLORS[charge.status]}`}>
          {STATUS_LABELS[charge.status]}
        </Badge>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <Card className="md:col-span-1">
          <CardHeader>
            <CardTitle>Informações</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground">Cliente</p>
              <Link
                href={`/clientes/${charge.customer.id}`}
                className="font-medium hover:underline"
              >
                {charge.customer.name}
              </Link>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">E-mail</p>
              <p>{charge.customer.email}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Valor</p>
              <p className="text-xl font-bold">
                {formatCurrency(charge.amountCents)}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Vencimento</p>
              <p>{formatDate(new Date(charge.dueDate))}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Criada em</p>
              <p>{formatDateTime(new Date(charge.createdAt))}</p>
            </div>

            <Separator />

            <div className="space-y-2">
              <p className="text-sm font-medium">Ações</p>
              <div className="flex flex-wrap gap-2">
                {charge.status !== "PAID" && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-green-200 text-green-600 hover:bg-green-50"
                    onClick={() => updateStatus("PAID")}
                    disabled={actionLoading !== null}
                  >
                    {actionLoading === "PAID" ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <CheckCircle className="mr-2 h-4 w-4" />
                    )}
                    Marcar como paga
                  </Button>
                )}
                {charge.status !== "CANCELED" && (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-red-200 text-red-600 hover:bg-red-50"
                        disabled={actionLoading !== null}
                      >
                        <XCircle className="mr-2 h-4 w-4" />
                        Cancelar
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Cancelar cobrança?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Esta ação marcará a cobrança como cancelada.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Voltar</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => updateStatus("CANCELED")}
                          className="bg-red-600 hover:bg-red-700"
                        >
                          Cancelar cobrança
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}
                {(charge.status === "PAID" || charge.status === "CANCELED") && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => updateStatus("PENDING")}
                    disabled={actionLoading !== null}
                  >
                    {actionLoading === "PENDING" ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <RotateCcw className="mr-2 h-4 w-4" />
                    )}
                    Reabrir
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Barcode className="h-5 w-5" />
              Boleto
            </CardTitle>
          </CardHeader>
          <CardContent>
            {charge.boleto ? (
              <div className="space-y-4">
                <div className="rounded-xl border bg-slate-50 p-4">
                  <p className="mb-2 text-sm font-medium text-muted-foreground">
                    Linha Digitável
                  </p>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 rounded bg-white p-2 text-sm font-mono break-all">
                      {charge.boleto.linhaDigitavel}
                    </code>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => copyToClipboard(charge.boleto!.linhaDigitavel)}
                    >
                      <Copy className="mr-2 h-4 w-4" />
                      Copiar linha digitável
                    </Button>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" asChild>
                    <Link href={charge.boleto.publicUrl} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="mr-2 h-4 w-4" aria-hidden="true" />
                      Abrir página pública
                    </Link>
                  </Button>
                  <Button variant="outline" asChild>
                    <Link href={charge.boleto.publicUrl} target="_blank" rel="noopener noreferrer">
                      <Printer className="mr-2 h-4 w-4" aria-hidden="true" />
                      Imprimir
                    </Link>
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-8">
                <FileText className="mb-4 h-12 w-12 text-muted-foreground" />
                <p className="mb-4 text-muted-foreground">
                  Boleto ainda não foi gerado para esta cobrança.
                </p>
                <Button
                  onClick={generateBoleto}
                  disabled={actionLoading !== null}
                >
                  {actionLoading === "boleto" ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Barcode className="mr-2 h-4 w-4" />
                  )}
                  Gerar boleto
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Histórico de lembretes e cobranças</CardTitle>
        </CardHeader>
        <CardContent>
          {charge.notificationLogs.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Canal</TableHead>
                  <TableHead>Gatilho</TableHead>
                  <TableHead>Agendado para</TableHead>
                  <TableHead>Enviado em</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Mensagem</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {charge.notificationLogs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell>
                      <Badge className={CHANNEL_COLORS[log.channel]}>
                        {CHANNEL_LABELS[log.channel]}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {log.step.trigger === "BEFORE_DUE" && `D-${log.step.offsetDays}`}
                      {log.step.trigger === "ON_DUE" && "D0"}
                      {log.step.trigger === "AFTER_DUE" && `D+${log.step.offsetDays}`}
                    </TableCell>
                    <TableCell>
                      {formatDateTime(new Date(log.scheduledFor))}
                    </TableCell>
                    <TableCell>
                      {log.sentAt ? formatDateTime(new Date(log.sentAt)) : "-"}
                    </TableCell>
                    <TableCell>
                      <Badge className={NOTIFICATION_STATUS_COLORS[log.status]}>
                        {NOTIFICATION_STATUS_LABELS[log.status]}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-xs truncate">
                      {log.renderedMessage.substring(0, 50)}&hellip;
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="py-8 text-center text-muted-foreground">
              Nenhum envio registrado ainda.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
