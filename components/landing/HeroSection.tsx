"use client";

export function HeroSection({ demoUrl }: { demoUrl: string }) {
  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
      {/* Background: static dashboard mockup */}
      <div className="absolute inset-0 opacity-[0.15] pointer-events-none">
        <DashboardMockup />
      </div>

      {/* Overlay gradient */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "linear-gradient(180deg, rgba(245,245,240,0.85) 0%, rgba(245,245,240,0.95) 50%, rgba(245,245,240,1) 100%)",
        }}
      />

      {/* Content */}
      <div className="relative z-10 text-center px-6 max-w-3xl mx-auto">
        <p className="text-xs uppercase tracking-[2px] font-semibold text-menlo-orange mb-4">
          Menlo Cobrança
        </p>
        <h1 className="text-3xl md:text-5xl font-bold text-menlo-black leading-tight mb-4">
          Recupere receita com cobrança automatizada
        </h1>
        <p className="text-gray-500 text-base md:text-lg mb-8 max-w-xl mx-auto">
          Crie réguas de cobrança inteligentes, automatize comunicações e
          acompanhe resultados em tempo real.
        </p>
        <div className="flex items-center justify-center gap-3">
          <a
            href={demoUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="bg-menlo-orange text-white px-7 py-3 rounded-xl font-semibold text-sm hover:bg-menlo-orange-dark transition-colors"
          >
            Agendar Demo
          </a>
          <button
            onClick={() =>
              document
                .getElementById("demo")
                ?.scrollIntoView({ behavior: "smooth" })
            }
            className="bg-white text-menlo-black px-7 py-3 rounded-xl font-semibold text-sm border border-gray-200 hover:border-gray-300 transition-colors"
          >
            Ver em ação ↓
          </button>
        </div>
      </div>
    </section>
  );
}

/** Static HTML/CSS mockup of the dashboard used as hero background */
function DashboardMockup() {
  return (
    <div className="w-full h-full flex items-center justify-center p-12 lg:p-24">
      <div className="bg-white rounded-2xl w-full max-w-5xl h-[500px] p-4 shadow-soft">
        {/* Browser dots */}
        <div className="flex gap-1.5 mb-4">
          <div className="w-2.5 h-2.5 rounded-full bg-red-400" />
          <div className="w-2.5 h-2.5 rounded-full bg-yellow-400" />
          <div className="w-2.5 h-2.5 rounded-full bg-green-400" />
        </div>
        <div className="flex gap-3 h-[calc(100%-28px)]">
          {/* Sidebar */}
          <div className="w-12 bg-gray-50 rounded-lg" />
          {/* Content */}
          <div className="flex-1 space-y-3">
            <div className="flex gap-3">
              <div className="flex-1 bg-gray-50 rounded-lg h-16" />
              <div className="flex-1 bg-gray-50 rounded-lg h-16" />
              <div className="flex-1 bg-gray-50 rounded-lg h-16" />
            </div>
            <div className="bg-gray-50 rounded-lg flex-1 h-48" />
            <div className="bg-gray-50 rounded-lg h-32" />
          </div>
        </div>
      </div>
    </div>
  );
}
