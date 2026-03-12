import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Menlo Cobrança — Cobrança automatizada e inteligente",
  description:
    "Crie réguas de cobrança inteligentes, automatize comunicações e acompanhe resultados em tempo real.",
};

export default function LandingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className="min-h-screen bg-menlo-offwhite">{children}</div>;
}
