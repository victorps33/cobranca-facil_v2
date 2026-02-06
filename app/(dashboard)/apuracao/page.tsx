"use client";

import { PageHeader } from "@/components/layout/PageHeader";
import { ApuracaoWizard } from "@/components/apuracao/ApuracaoWizard";

export default function ApuracaoPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Apuracao"
        subtitle="Ciclo completo de apuracao de franqueados"
      />
      <ApuracaoWizard />
    </div>
  );
}
