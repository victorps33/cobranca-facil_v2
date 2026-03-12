import { Zap, Brain, TrendingUp } from "lucide-react";

const features = [
  {
    icon: Zap,
    title: "Réguas Inteligentes",
    description: "Automatize o fluxo de cobrança do início ao fim",
    color: "bg-orange-50 text-menlo-orange",
  },
  {
    icon: Brain,
    title: "IA Integrada",
    description: "Julia analisa padrões e sugere as melhores ações",
    color: "bg-blue-50 text-blue-500",
  },
  {
    icon: TrendingUp,
    title: "Resultados Reais",
    description: "Acompanhe recuperação de receita em tempo real",
    color: "bg-green-50 text-green-500",
  },
];

export function FeaturesSection() {
  return (
    <section className="bg-white py-16 md:py-24 px-6">
      <div className="max-w-4xl mx-auto">
        <h2 className="text-2xl md:text-3xl font-bold text-menlo-black text-center mb-12">
          Por que escolher a Menlo?
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {features.map((f) => (
            <div key={f.title} className="text-center">
              <div
                className={`w-12 h-12 rounded-xl ${f.color} mx-auto mb-4 flex items-center justify-center`}
              >
                <f.icon className="w-5 h-5" />
              </div>
              <h3 className="text-base font-semibold text-menlo-black mb-2">
                {f.title}
              </h3>
              <p className="text-sm text-gray-500">{f.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
