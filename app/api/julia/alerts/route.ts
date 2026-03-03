import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireTenantOrGroup } from "@/lib/auth-helpers";
import { headers } from "next/headers";

export async function GET() {
  const headerList = headers();
  const requestedId = headerList.get("x-franqueadora-id") || null;
  const { tenantIds, error } = await requireTenantOrGroup(
    requestedId === "all" ? null : requestedId
  );
  if (error) return error;

  try {
    const charges = await prisma.charge.findMany({
      where: { customer: { franqueadoraId: { in: tenantIds } } },
      include: { customer: { select: { name: true, id: true } } },
      orderBy: { dueDate: "asc" },
    });

    if (charges.length === 0) {
      return NextResponse.json({ alerts: [], quickQuestions: [] });
    }

    const now = new Date();
    const alerts: { id: string; type: "critical" | "warning" | "success"; title: string; description: string; question: string }[] = [];

    // ── Alert 1: Customers with most overdue charges ──
    const overdueCharges = charges.filter((c) => c.status === "OVERDUE");
    if (overdueCharges.length > 0) {
      const byCustomer: Record<string, { name: string; total: number; count: number }> = {};
      overdueCharges.forEach((c) => {
        if (!byCustomer[c.customerId]) byCustomer[c.customerId] = { name: c.customer.name, total: 0, count: 0 };
        byCustomer[c.customerId].total += c.amountCents;
        byCustomer[c.customerId].count += 1;
      });
      const sorted = Object.values(byCustomer).sort((a, b) => b.total - a.total);
      const worst = sorted[0];
      const totalOverdue = overdueCharges.reduce((s, c) => s + c.amountCents, 0);
      const fmtValue = (cents: number) => `R$ ${(cents / 100).toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

      alerts.push({
        id: "alert-overdue",
        type: "critical",
        title: `${worst.name}: ${worst.count} cobrança${worst.count > 1 ? "s" : ""} vencida${worst.count > 1 ? "s" : ""}`,
        description: `Total vencido: ${fmtValue(worst.total)} · Rede total: ${fmtValue(totalOverdue)} em ${overdueCharges.length} cobranças`,
        question: `Detalhe a situação de ${worst.name}. Quais cobranças estão vencidas e qual o impacto?`,
      });
    }

    // ── Alert 2: Charges due this week ──
    const weekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const dueThisWeek = charges.filter((c) => {
      const due = new Date(c.dueDate);
      return c.status === "PENDING" && due >= now && due <= weekFromNow;
    });
    if (dueThisWeek.length > 0) {
      const totalDue = dueThisWeek.reduce((s, c) => s + c.amountCents, 0);
      const fmtValue = (cents: number) => {
        const reais = cents / 100;
        if (reais >= 1000) return `R$ ${(reais / 1000).toFixed(1).replace(".", ",")}k`;
        return `R$ ${reais.toLocaleString("pt-BR", { minimumFractionDigits: 0 })}`;
      };
      alerts.push({
        id: "alert-due-week",
        type: "warning",
        title: `${fmtValue(totalDue)} vencem esta semana`,
        description: `${dueThisWeek.length} cobrança${dueThisWeek.length > 1 ? "s" : ""} com vencimento nos próximos 7 dias`,
        question: "Quais cobranças vencem esta semana? Liste por ordem de vencimento.",
      });
    }

    // ── Alert 3: Recent payments (positive) ──
    const recentPaid = charges.filter((c) => {
      if (c.status !== "PAID" || !c.paidAt) return false;
      const paidDate = new Date(c.paidAt);
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      return paidDate >= sevenDaysAgo;
    });
    if (recentPaid.length > 0) {
      const byCustomer: Record<string, { name: string; total: number; count: number }> = {};
      recentPaid.forEach((c) => {
        if (!byCustomer[c.customerId]) byCustomer[c.customerId] = { name: c.customer.name, total: 0, count: 0 };
        byCustomer[c.customerId].total += c.amountCents;
        byCustomer[c.customerId].count += 1;
      });
      const sorted = Object.values(byCustomer).sort((a, b) => b.total - a.total);
      const best = sorted[0];
      const fmtValue = (cents: number) => {
        const reais = cents / 100;
        if (reais >= 1000) return `R$ ${(reais / 1000).toFixed(1).replace(".", ",")}k`;
        return `R$ ${reais.toLocaleString("pt-BR", { minimumFractionDigits: 0 })}`;
      };
      alerts.push({
        id: "alert-paid-recent",
        type: "success",
        title: `${best.name} pagou ${fmtValue(best.total)}`,
        description: `${best.count} cobrança${best.count > 1 ? "s" : ""} paga${best.count > 1 ? "s" : ""} nos últimos 7 dias`,
        question: `O que mudou com ${best.name}? Detalhe os pagamentos recentes.`,
      });
    }

    // If no positive alert, show overall payment stats
    if (alerts.length < 3) {
      const paidCharges = charges.filter((c) => c.status === "PAID");
      const totalPaid = paidCharges.reduce((s, c) => s + c.amountCents, 0);
      const totalEmitted = charges.reduce((s, c) => s + c.amountCents, 0);
      const rate = totalEmitted > 0 ? ((totalPaid / totalEmitted) * 100).toFixed(1) : "0";
      alerts.push({
        id: "alert-rate",
        type: Number(rate) >= 70 ? "success" : "warning",
        title: `Taxa de recebimento: ${rate}%`,
        description: `${paidCharges.length} de ${charges.length} cobranças pagas`,
        question: "Qual a taxa de recebimento atual da rede? Analise por cliente.",
      });
    }

    return NextResponse.json({ alerts: alerts.slice(0, 3) });
  } catch (err) {
    console.error("Julia alerts API error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
