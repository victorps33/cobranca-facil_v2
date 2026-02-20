"use client";

import { useState, useEffect, useCallback } from "react";
import { Sidebar } from "@/components/sidebar";
import { TopBar } from "@/components/topbar";
import { ScrollToTop } from "@/components/scroll-to-top";
import { OnboardingWizard } from "@/components/onboarding/OnboardingWizard";
import { JuliaPanel } from "@/components/ai/JuliaPanel";
import { JuliaOnboardingWizard } from "@/components/ai/JuliaOnboardingWizard";
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
  const [juliaOnboardingOpen, setJuliaOnboardingOpen] = useState(false);
  const [juliaDisabled, setJuliaDisabled] = useState(false);
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

  // Read julia_enabled preference from localStorage
  useEffect(() => {
    const enabled = localStorage.getItem("julia_enabled");
    setJuliaDisabled(enabled === "false");
  }, []);

  // Listen for julia_enabled changes (from settings page)
  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === "julia_enabled") {
        setJuliaDisabled(e.newValue === "false");
      }
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
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

  const handleOpenJulia = useCallback(() => {
    if (juliaDisabled) return;
    const onboardingDone = localStorage.getItem("julia_onboarding_done");
    if (!onboardingDone) {
      setJuliaOnboardingOpen(true);
    } else {
      setJuliaOpen(true);
    }
  }, [juliaDisabled]);

  const handleJuliaOnboardingComplete = useCallback(() => {
    setJuliaOnboardingOpen(false);
    setJuliaOpen(true);
  }, []);

  const handleCloseJulia = useCallback(() => setJuliaOpen(false), []);
  const handleCloseCommandPalette = useCallback(() => setCommandPaletteOpen(false), []);

  return (
    <AppDataProvider>
      <div className="flex h-screen bg-background overflow-hidden">
        <Sidebar />
        <div className="flex flex-1 flex-col min-h-0">
          <TopBar
            onOpenJulia={handleOpenJulia}
            onOpenCommandPalette={() => setCommandPaletteOpen(true)}
            juliaDisabled={juliaDisabled}
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

        {/* Julia Onboarding Wizard */}
        <JuliaOnboardingWizard
          open={juliaOnboardingOpen}
          onComplete={handleJuliaOnboardingComplete}
        />

        {/* Global AI Panel */}
        {!juliaDisabled && (
          <JuliaPanel open={juliaOpen} onClose={handleCloseJulia} />
        )}

        {/* Command Palette */}
        <CommandPalette open={commandPaletteOpen} onClose={handleCloseCommandPalette} />
      </div>
    </AppDataProvider>
  );
}
