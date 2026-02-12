"use client";

import { useState, useEffect } from "react";
import { Sidebar } from "@/components/sidebar";
import { TopBar } from "@/components/topbar";
import { ScrollToTop } from "@/components/scroll-to-top";
import { OnboardingWizard } from "@/components/onboarding/OnboardingWizard";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [showWizard, setShowWizard] = useState(false);
  const [wizardChecked, setWizardChecked] = useState(false);

  useEffect(() => {
    fetch("/api/onboarding/status")
      .then((r) => r.json())
      .then((data) => {
        setShowWizard(data.showWizard);
      })
      .catch(() => {})
      .finally(() => setWizardChecked(true));
  }, []);

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <Sidebar />
      <div className="flex flex-1 flex-col min-h-0">
        <TopBar />
        <main id="main-content" className="flex-1 min-h-0 overflow-y-auto p-6 lg:p-8">
          <ScrollToTop />
          <div className="max-w-7xl mx-auto min-h-full">{children}</div>
        </main>
      </div>

      {wizardChecked && showWizard && (
        <OnboardingWizard
          open={showWizard}
          onComplete={() => setShowWizard(false)}
        />
      )}
    </div>
  );
}
