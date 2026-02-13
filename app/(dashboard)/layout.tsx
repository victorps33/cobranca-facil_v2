"use client";

import { useState, useEffect, useCallback } from "react";
import { Sidebar } from "@/components/sidebar";
import { TopBar } from "@/components/topbar";
import { ScrollToTop } from "@/components/scroll-to-top";
import { OnboardingWizard } from "@/components/onboarding/OnboardingWizard";
import { JuliaPanel } from "@/components/ai/JuliaPanel";
import { CommandPalette } from "@/components/command-palette/CommandPalette";
import { AppDataProvider } from "@/components/providers/AppDataProvider";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [showWizard, setShowWizard] = useState(false);
  const [wizardChecked, setWizardChecked] = useState(false);
  const [juliaOpen, setJuliaOpen] = useState(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);

  useEffect(() => {
    fetch("/api/onboarding/status")
      .then((r) => r.json())
      .then((data) => {
        setShowWizard(data.showWizard);
      })
      .catch(() => {})
      .finally(() => setWizardChecked(true));
  }, []);

  // Global Cmd+K shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setCommandPaletteOpen((v) => !v);
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  const handleCloseJulia = useCallback(() => setJuliaOpen(false), []);
  const handleCloseCommandPalette = useCallback(() => setCommandPaletteOpen(false), []);

  return (
    <AppDataProvider>
      <div className="flex h-screen bg-background overflow-hidden">
        <Sidebar />
        <div className="flex flex-1 flex-col min-h-0">
          <TopBar
            onOpenJulia={() => setJuliaOpen(true)}
            onOpenCommandPalette={() => setCommandPaletteOpen(true)}
          />
          <main id="main-content" className="flex-1 min-h-0 overflow-y-auto p-6 lg:p-8">
            <ScrollToTop />
            <div className="max-w-7xl mx-auto min-h-full">
              {children}
            </div>
          </main>
        </div>

        {wizardChecked && showWizard && (
          <OnboardingWizard
            open={showWizard}
            onComplete={() => setShowWizard(false)}
          />
        )}

        {/* Global AI Panel */}
        <JuliaPanel open={juliaOpen} onClose={handleCloseJulia} />

        {/* Command Palette */}
        <CommandPalette open={commandPaletteOpen} onClose={handleCloseCommandPalette} />
      </div>
    </AppDataProvider>
  );
}
