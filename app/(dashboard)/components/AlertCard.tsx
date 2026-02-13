"use client";

import { useState, useEffect } from "react";
import { Sparkles, X, ArrowRight } from "lucide-react";
import Link from "next/link";

interface AlertCardProps {
  title?: string;
  message: string;
  ctaLabel?: string;
  ctaHref?: string;
  onDismiss?: () => void;
}

export function AlertCard({
  title = "Insight da Júlia",
  message,
  ctaLabel = "Ver franqueados",
  ctaHref = "/dividas",
  onDismiss,
}: AlertCardProps) {
  const [visible, setVisible] = useState(true);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("alert-dismissed");
    if (stored) {
      const data = JSON.parse(stored);
      const now = new Date().getTime();
      // Dismiss for 24 hours
      if (data.timestamp && now - data.timestamp < 24 * 60 * 60 * 1000) {
        setDismissed(true);
      }
    }
  }, []);

  const handleDismiss = () => {
    setVisible(false);
    localStorage.setItem(
      "alert-dismissed",
      JSON.stringify({ timestamp: new Date().getTime() })
    );
    onDismiss?.();
  };

  if (!visible || dismissed) return null;

  return (
    <div className="bg-gradient-to-r from-blue-500 to-blue-600 rounded-2xl p-5 text-white relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2" />
      <div className="absolute bottom-0 left-0 w-32 h-32 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/2" />

      <div className="relative flex items-start gap-4">
        {/* Avatar */}
        <div className="h-12 w-12 rounded-2xl bg-white/20 backdrop-blur flex items-center justify-center flex-shrink-0">
          <Sparkles className="h-6 w-6 text-white" />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-semibold">Júlia — Agente Menlo IA</h3>
            <span className="px-2 py-0.5 bg-white/20 rounded-full text-xs font-medium">
              IA
            </span>
          </div>
          <p className="text-white/90 text-sm leading-relaxed">{message}</p>

          {/* Actions */}
          <div className="flex items-center gap-3 mt-4">
            <Link
              href={ctaHref}
              className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white text-sm font-medium rounded-full hover:bg-primary-hover transition-colors"
            >
              {ctaLabel}
              <ArrowRight className="h-4 w-4" />
            </Link>
            <button
              onClick={handleDismiss}
              className="px-4 py-2 text-white/70 text-sm font-medium hover:text-white transition-colors"
            >
              Ignorar
            </button>
          </div>
        </div>

        {/* Close button */}
        <button
          onClick={handleDismiss}
          className="p-1.5 hover:bg-white/10 rounded-xl transition-colors flex-shrink-0"
        >
          <X className="h-4 w-4 text-white/70" />
        </button>
      </div>
    </div>
  );
}
