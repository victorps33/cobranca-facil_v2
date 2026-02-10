import type { Metadata } from "next";
import { Poppins } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { AuthSessionProvider } from "@/components/providers/session-provider";

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-poppins",
});

export const metadata: Metadata = {
  title: "Menlo - Plataforma de Cobranças",
  description: "Sistema de gestão de cobranças para franqueadoras",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR" className="h-full overflow-hidden">
      <body className={`${poppins.variable} font-sans antialiased h-full overflow-hidden`}>
        <AuthSessionProvider>
          <a
            href="#main-content"
            className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[100] focus:px-4 focus:py-2 focus:bg-white focus:text-gray-900 focus:rounded-lg focus:shadow-lg focus:ring-2 focus:ring-secondary focus:outline-none"
          >
            Pular para o conteúdo principal
          </a>
          {children}
          <Toaster />
        </AuthSessionProvider>
      </body>
    </html>
  );
}
