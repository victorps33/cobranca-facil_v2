"use client";

import { useEffect, useRef, useState } from "react";

export function DemoAnimation() {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [activeScreen, setActiveScreen] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.2 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Sync dot indicator with CSS animation cycle (3s per screen, 9s total)
  useEffect(() => {
    if (!visible) return;
    const interval = setInterval(() => {
      setActiveScreen((prev) => (prev + 1) % 3);
    }, 3000);
    return () => clearInterval(interval);
  }, [visible]);

  return (
    <section id="demo" className="bg-menlo-offwhite px-6 py-16 md:py-24">
      <div
        ref={ref}
        className={`max-w-4xl mx-auto transition-all duration-700 ${
          visible
            ? "opacity-100 translate-y-0"
            : "opacity-0 translate-y-6"
        }`}
      >
        {/* Browser frame */}
        <div className="rounded-2xl shadow-large overflow-hidden bg-white">
          {/* Chrome bar */}
          <div className="bg-gray-50 border-b border-gray-200 px-4 py-2.5 flex items-center gap-2">
            <div className="flex gap-1.5">
              <div className="w-3 h-3 rounded-full bg-red-400" />
              <div className="w-3 h-3 rounded-full bg-yellow-400" />
              <div className="w-3 h-3 rounded-full bg-green-400" />
            </div>
            <div className="flex-1 ml-3 bg-gray-100 rounded-md h-7 flex items-center px-3">
              <span className="text-xs text-gray-400">
                app.menlocobranca.com.br
              </span>
            </div>
          </div>

          {/* Screen area */}
          <div className="relative h-[300px] md:h-[420px] overflow-hidden">
            {visible && (
              <>
                <div className="landing-screen absolute inset-0 p-6 md:p-8">
                  <ScreenNovaCobranca />
                </div>
                <div className="landing-screen absolute inset-0 p-6 md:p-8">
                  <ScreenReguaAtiva />
                </div>
                <div className="landing-screen absolute inset-0 p-6 md:p-8">
                  <ScreenResultado />
                </div>
              </>
            )}
          </div>
        </div>

        {/* Dot indicators */}
        <div className="flex justify-center gap-2 mt-4">
          {["Nova Cobrança", "Régua Ativa", "Resultado"].map((label, i) => (
            <button
              key={label}
              className={`h-2 rounded-full transition-all duration-300 ${
                i === activeScreen
                  ? "w-6 bg-menlo-orange"
                  : "w-2 bg-gray-300"
              }`}
              aria-label={label}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─── Screen Mockups ─── */

function ScreenNovaCobranca() {
  return (
    <div>
      <div className="flex items-center gap-2 mb-6">
        <div className="w-2 h-2 rounded-full bg-menlo-orange" />
        <span className="text-xs font-semibold text-menlo-orange uppercase tracking-wide">
          Etapa 1
        </span>
      </div>
      <h3 className="text-lg md:text-xl font-bold text-menlo-black mb-1">
        Nova Cobrança
      </h3>
      <p className="text-sm text-gray-400 mb-6">
        Crie uma cobrança em segundos
      </p>
      <div className="space-y-3 max-w-md">
        <div className="flex gap-3">
          <div className="flex-1">
            <div className="text-[10px] text-gray-400 mb-1">Cliente</div>
            <div className="h-9 bg-gray-50 rounded-lg border border-gray-200 flex items-center px-3">
              <span className="text-xs text-gray-500">Franquia Centro SP</span>
            </div>
          </div>
          <div className="flex-1">
            <div className="text-[10px] text-gray-400 mb-1">Valor</div>
            <div className="h-9 bg-gray-50 rounded-lg border border-gray-200 flex items-center px-3">
              <span className="text-xs text-gray-500">R$ 2.450,00</span>
            </div>
          </div>
        </div>
        <div>
          <div className="text-[10px] text-gray-400 mb-1">Vencimento</div>
          <div className="h-9 bg-gray-50 rounded-lg border border-gray-200 flex items-center px-3">
            <span className="text-xs text-gray-500">15/03/2026</span>
          </div>
        </div>
        <div>
          <div className="text-[10px] text-gray-400 mb-1">Régua de Cobrança</div>
          <div className="h-9 bg-orange-50 rounded-lg border border-orange-200 flex items-center px-3">
            <span className="text-xs text-menlo-orange font-medium">
              Régua Padrão — 3 etapas
            </span>
          </div>
        </div>
        <button className="bg-menlo-orange text-white text-xs font-semibold px-5 py-2.5 rounded-lg mt-2">
          Criar Cobrança
        </button>
      </div>
    </div>
  );
}

function ScreenReguaAtiva() {
  const steps = [
    { label: "Lembrete", desc: "3 dias antes", status: "done" },
    { label: "Notificação", desc: "No vencimento", status: "active" },
    { label: "Escalação", desc: "7 dias após", status: "pending" },
  ];

  return (
    <div>
      <div className="flex items-center gap-2 mb-6">
        <div className="w-2 h-2 rounded-full bg-menlo-orange" />
        <span className="text-xs font-semibold text-menlo-orange uppercase tracking-wide">
          Etapa 2
        </span>
      </div>
      <h3 className="text-lg md:text-xl font-bold text-menlo-black mb-1">
        Régua Ativa
      </h3>
      <p className="text-sm text-gray-400 mb-6">
        Acompanhe cada etapa da cobrança
      </p>
      <div className="space-y-4 max-w-md">
        {steps.map((step) => (
          <div key={step.label} className="flex items-center gap-4">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                step.status === "done"
                  ? "bg-green-100 text-green-600"
                  : step.status === "active"
                    ? "bg-orange-100 text-menlo-orange ring-2 ring-menlo-orange/30"
                    : "bg-gray-100 text-gray-400"
              }`}
            >
              {step.status === "done" ? "✓" : step.status === "active" ? "●" : "○"}
            </div>
            <div className="flex-1">
              <div className="text-sm font-semibold text-menlo-black">
                {step.label}
              </div>
              <div className="text-xs text-gray-400">{step.desc}</div>
            </div>
            {step.status === "active" && (
              <span className="text-[10px] bg-orange-50 text-menlo-orange px-2 py-0.5 rounded-full font-medium">
                Em andamento
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function ScreenResultado() {
  const metrics = [
    { label: "Receita Recuperada", value: "R$ 47.200", trend: "+23%" },
    { label: "Taxa de Sucesso", value: "78%", trend: "+5%" },
    { label: "Tempo Médio", value: "4.2 dias", trend: "-18%" },
  ];

  return (
    <div>
      <div className="flex items-center gap-2 mb-6">
        <div className="w-2 h-2 rounded-full bg-menlo-orange" />
        <span className="text-xs font-semibold text-menlo-orange uppercase tracking-wide">
          Etapa 3
        </span>
      </div>
      <h3 className="text-lg md:text-xl font-bold text-menlo-black mb-1">
        Resultado
      </h3>
      <p className="text-sm text-gray-400 mb-6">
        Acompanhe a recuperação em tempo real
      </p>
      <div className="grid grid-cols-3 gap-3 max-w-lg">
        {metrics.map((m) => (
          <div
            key={m.label}
            className="bg-gray-50 rounded-xl p-4 border border-gray-100"
          >
            <div className="text-[10px] text-gray-400 mb-2">{m.label}</div>
            <div className="text-lg md:text-xl font-bold text-menlo-black">
              {m.value}
            </div>
            <div
              className={`text-xs font-medium mt-1 ${
                m.trend.startsWith("+") ? "text-green-500" : "text-blue-500"
              }`}
            >
              {m.trend}
            </div>
          </div>
        ))}
      </div>
      {/* Mini chart placeholder */}
      <div className="mt-4 max-w-lg h-20 bg-gray-50 rounded-xl border border-gray-100 flex items-end px-4 pb-2 gap-1">
        {[40, 55, 35, 65, 50, 70, 60, 80, 75, 90, 85, 95].map((h, i) => (
          <div
            key={i}
            className="flex-1 bg-menlo-orange/20 rounded-t"
            style={{ height: `${h}%` }}
          >
            <div
              className="w-full bg-menlo-orange rounded-t"
              style={{ height: "40%" }}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
