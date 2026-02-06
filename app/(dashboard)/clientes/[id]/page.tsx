"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  Plus,
  Loader2,
  Trash2,
  Pencil,
  Mail,
  Phone,
  FileText,
} from "lucide-react";
import {
  formatCurrency,
  formatDate,
  STATUS_LABELS,
  STATUS_COLORS,
} from "@/lib/utils";

interface Customer {
  id: string;
  name: string;
  doc: string;
  email: string;
  phone: string;
  createdAt: string;
  charges: Array<{
    id: string;
    description: string;
    amountCents: number;
    dueDate: string;
    status: string;
    boleto: { id: string } | null;
  }>;
}

export default function ClienteDetalhePage() {
  const params = useParams();
  const router = useRouter();
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [loading, setLoading] = useState(true);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [chargeDialogOpen, setChargeDialogOpen] = useState(false);
  const [formLoading, setFormLoading] = useState(false);
  const [editData, setEditData] = useState({
    name: "",
    doc: "",
    email: "",
    phone: "",
  });
  const [chargeData, setChargeData] = useState({
    description: "",
    amountCents: "",
    dueDate: "",
  });

  const fetchCustomer = async () => {
    try {
      const res = await fetch(`/api/customers/${params.id}`);
      if (!res.ok) throw new Error("Customer not found");
      const data = await res.json();
      setCustomer(data);
      setEditData({
        name: data.name,
        doc: data.doc,
        email: data.email,
        phone: data.phone,
      });
    } catch (error) {
      toast({
        title: "Erro",
        description: "Cliente não encontrado",
        variant: "destructive",
      });
      router.push("/clientes");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCustomer();
  }, [params.id]);

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormLoading(true);
    try {
      const res = await fetch(`/api/customers/${params.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editData),
      });

      if (!res.ok) throw new Error("Failed to update");

      toast({
        title: "Cliente atualizado!",
        description: "As informações foram atualizadas com sucesso.",
      });

      setEditDialogOpen(false);
      fetchCustomer();
    } catch (error) {
      toast({
        title: "Erro",
        description: "Falha ao atualizar cliente",
        variant: "destructive",
      });
    } finally {
      setFormLoading(false);
    }
  };

  const handleDelete = async () => {
    try {
      const res = await fetch(`/api/customers/${params.id}`, {
        method: "DELETE",
      });

      if (!res.ok) throw new Error("Failed to delete");

      toast({
        title: "Cliente excluído!",
        description: "O cliente foi removido com sucesso.",
      });

      router.push("/clientes");
    } catch (error) {
      toast({
        title: "Erro",
        description: "Falha ao excluir cliente",
        variant: "destructive",
      });
    }
  };

  const handleCreateCharge = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormLoading(true);
    try {
      const res = await fetch("/api/charges", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId: params.id,
          description: chargeData.description,
          amountCents: Math.round(parseFloat(chargeData.amountCents) * 100),
          dueDate: chargeData.dueDate,
        }),
      });

      if (!res.ok) throw new Error("Failed to create charge");

      toast({
        title: "Cobrança criada!",
        description: "A cobrança foi criada com sucesso.",
      });

      setChargeDialogOpen(false);
      setChargeData({ description: "", amountCents: "", dueDate: "" });
      fetchCustomer();
    } catch (error) {
      toast({
        title: "Erro",
        description: "Falha ao criar cobrança",
        variant: "destructive",
      });
    } finally {
      setFormLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (!customer) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/clientes" aria-label="Voltar para clientes">
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          </Link>
        </Button>
        <h1 className="text-2xl font-bold">{customer.name}</h1>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <Card className="md:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              Informações
              <div className="flex gap-2">
                <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="icon" aria-label="Editar cliente">
                      <Pencil className="h-4 w-4" aria-hidden="true" />
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Editar Cliente</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleUpdate} className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="edit-name">Nome</Label>
                        <Input
                          id="edit-name"
                          name="name"
                          autoComplete="name"
                          value={editData.name}
                          onChange={(e) =>
                            setEditData({ ...editData, name: e.target.value })
                          }
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="edit-doc">CPF/CNPJ</Label>
                        <Input
                          id="edit-doc"
                          name="doc"
                          value={editData.doc}
                          onChange={(e) =>
                            setEditData({ ...editData, doc: e.target.value })
                          }
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="edit-email">E-mail</Label>
                        <Input
                          id="edit-email"
                          name="email"
                          type="email"
                          autoComplete="email"
                          spellCheck={false}
                          value={editData.email}
                          onChange={(e) =>
                            setEditData({ ...editData, email: e.target.value })
                          }
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="edit-phone">Telefone</Label>
                        <Input
                          id="edit-phone"
                          name="phone"
                          type="tel"
                          inputMode="tel"
                          autoComplete="tel"
                          value={editData.phone}
                          onChange={(e) =>
                            setEditData({ ...editData, phone: e.target.value })
                          }
                          required
                        />
                      </div>
                      <DialogFooter>
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
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="outline" size="icon" aria-label="Excluir cliente">
                      <Trash2 className="h-4 w-4 text-red-500" aria-hidden="true" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Excluir cliente?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Esta ação não pode ser desfeita. Todas as cobranças
                        associadas também serão excluídas.
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
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3">
              <FileText className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
              <span>{customer.doc}</span>
            </div>
            <div className="flex items-center gap-3">
              <Mail className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
              <span>{customer.email}</span>
            </div>
            <div className="flex items-center gap-3">
              <Phone className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
              <span>{customer.phone}</span>
            </div>
            <Separator />
            <div className="text-sm text-muted-foreground">
              Cliente desde {formatDate(new Date(customer.createdAt))}
            </div>
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Cobranças</CardTitle>
            <Dialog open={chargeDialogOpen} onOpenChange={setChargeDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  Criar cobrança
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Nova Cobrança</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleCreateCharge} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="charge-description">Descrição</Label>
                    <Input
                      id="charge-description"
                      name="description"
                      value={chargeData.description}
                      onChange={(e) =>
                        setChargeData({
                          ...chargeData,
                          description: e.target.value,
                        })
                      }
                      placeholder="Ex: Mensalidade Janeiro…"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="charge-amount">Valor (R$)</Label>
                    <Input
                      id="charge-amount"
                      name="amount"
                      type="number"
                      inputMode="decimal"
                      step="0.01"
                      min="0.01"
                      value={chargeData.amountCents}
                      onChange={(e) =>
                        setChargeData({
                          ...chargeData,
                          amountCents: e.target.value,
                        })
                      }
                      placeholder="100,00"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="charge-due">Vencimento</Label>
                    <Input
                      id="charge-due"
                      name="dueDate"
                      type="date"
                      value={chargeData.dueDate}
                      onChange={(e) =>
                        setChargeData({ ...chargeData, dueDate: e.target.value })
                      }
                      required
                    />
                  </div>
                  <DialogFooter>
                    <Button type="submit" disabled={formLoading}>
                      {formLoading && (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      )}
                      Criar
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </CardHeader>
          <CardContent>
            {customer.charges.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Descrição</TableHead>
                    <TableHead>Valor</TableHead>
                    <TableHead>Vencimento</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {customer.charges.map((charge) => (
                    <TableRow key={charge.id}>
                      <TableCell className="font-medium">
                        {charge.description}
                      </TableCell>
                      <TableCell>{formatCurrency(charge.amountCents)}</TableCell>
                      <TableCell>
                        {formatDate(new Date(charge.dueDate))}
                      </TableCell>
                      <TableCell>
                        <Badge className={STATUS_COLORS[charge.status]}>
                          {STATUS_LABELS[charge.status]}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm" asChild>
                          <Link href={`/cobrancas/${charge.id}`}>
                            Ver
                          </Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="py-8 text-center text-muted-foreground">
                Nenhuma cobrança ainda.
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
