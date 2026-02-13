"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { MenloLogo } from "@/components/brand/MenloLogo";
import { useToast } from "@/components/ui/use-toast";

export function LoginForm({ googleEnabled }: { googleEnabled: boolean }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const searchParams = useSearchParams();
  const { toast } = useToast();

  const callbackUrl = searchParams.get("callbackUrl") || "/";
  const error = searchParams.get("error");

  async function handleCredentialsLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
      callbackUrl,
    });

    if (result?.error) {
      toast({
        title: "Erro ao entrar",
        description: "Email ou senha incorretos.",
        variant: "destructive",
      });
      setLoading(false);
      return;
    }

    window.location.href = callbackUrl;
  }

  function handleGoogleLogin() {
    signIn("google", { callbackUrl });
  }

  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-[#f6f9fc]">
      {/* Background gradient decoration */}
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        {/* Large flowing shape - top right */}
        <div
          className="absolute -right-[10%] -top-[20%] h-[120%] w-[60%] opacity-30"
          style={{
            background:
              "linear-gradient(135deg, var(--menlo-blue) 0%, #a8c4f0 20%, var(--menlo-orange) 45%, #ff8c47 65%, #ff6b9d 80%, var(--menlo-blue) 100%)",
            borderRadius: "30% 70% 70% 30% / 30% 30% 70% 70%",
            transform: "rotate(-12deg)",
            filter: "blur(40px)",
          }}
        />
        {/* Secondary accent shape */}
        <div
          className="absolute -bottom-[10%] -right-[5%] h-[60%] w-[35%] opacity-20"
          style={{
            background:
              "linear-gradient(180deg, var(--menlo-orange) 0%, #ff8c47 40%, var(--menlo-blue) 100%)",
            borderRadius: "60% 40% 30% 70% / 60% 30% 70% 40%",
            transform: "rotate(15deg)",
            filter: "blur(50px)",
          }}
        />
        {/* Subtle top-left accent */}
        <div
          className="absolute -left-[5%] -top-[5%] h-[40%] w-[30%] opacity-10"
          style={{
            background:
              "linear-gradient(225deg, var(--menlo-blue) 0%, #a8c4f0 100%)",
            borderRadius: "30% 70% 70% 30% / 30% 30% 70% 70%",
            filter: "blur(60px)",
          }}
        />
      </div>

      {/* Centered card */}
      <div className="relative z-10 flex min-h-screen items-center justify-center px-4 py-12">
        <div className="w-full max-w-[480px]">
          <div
            className="rounded-2xl bg-white shadow-lg"
            style={{
              boxShadow:
                "0 2px 4px rgba(0,0,0,0.02), 0 8px 24px rgba(0,0,0,0.06), 0 24px 48px rgba(0,0,0,0.04)",
            }}
          >
            {/* Logo inside card */}
            <div className="flex justify-center pt-10 pb-6">
              <MenloLogo size="md" variant="sidebar" />
            </div>

            {/* Header with divider */}
            <div className="px-10 pb-2">
              <h1 className="text-xl font-semibold text-gray-900">
                Acesse sua conta
              </h1>
            </div>
            <div className="mx-10 border-t border-gray-200" />

            {/* Form content */}
            <div className="px-10 pt-6 pb-10">
              {error && (
                <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                  Ocorreu um erro ao tentar entrar. Tente novamente.
                </div>
              )}

              {/* Credentials form */}
              <form onSubmit={handleCredentialsLogin} className="space-y-5">
                <div className="space-y-1.5">
                  <label
                    htmlFor="email"
                    className="block text-sm font-medium text-gray-700"
                  >
                    E-mail
                  </label>
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoComplete="email"
                    className="block w-full rounded-xl border border-gray-300 bg-white px-4 py-3.5 text-sm text-gray-900 placeholder-gray-400 transition-all focus:border-secondary focus:outline-none focus:ring-2 focus:ring-secondary/30"
                  />
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label
                      htmlFor="password"
                      className="block text-sm font-medium text-gray-700"
                    >
                      Senha
                    </label>
                    <button
                      type="button"
                      className="text-sm font-medium text-primary hover:text-primary-hover transition-colors"
                      tabIndex={-1}
                    >
                      Esqueceu sua senha?
                    </button>
                  </div>
                  <input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    autoComplete="current-password"
                    className="block w-full rounded-xl border border-gray-300 bg-white px-4 py-3.5 text-sm text-gray-900 placeholder-gray-400 transition-all focus:border-secondary focus:outline-none focus:ring-2 focus:ring-secondary/30"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="flex w-full items-center justify-center rounded-xl bg-primary px-4 py-3.5 text-sm font-semibold text-white transition-all hover:bg-primary-hover focus:outline-none focus:ring-2 focus:ring-primary/40 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {loading ? (
                    <span className="flex items-center gap-2">
                      <svg
                        className="h-4 w-4 animate-spin"
                        viewBox="0 0 24 24"
                        fill="none"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        />
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                        />
                      </svg>
                      Entrando...
                    </span>
                  ) : (
                    "Entrar"
                  )}
                </button>
              </form>

              {/* Google OAuth */}
              {googleEnabled && (
                <>
                  {/* Divider */}
                  <div className="my-6 border-t border-gray-200" />

                  <button
                    type="button"
                    onClick={handleGoogleLogin}
                    className="flex w-full items-center justify-center gap-3 rounded-xl border border-gray-300 bg-white px-4 py-3.5 text-sm font-medium text-gray-700 transition-all hover:bg-gray-50 hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-200"
                  >
                    <svg className="h-5 w-5" viewBox="0 0 24 24">
                      <path
                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                        fill="#4285F4"
                      />
                      <path
                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                        fill="#34A853"
                      />
                      <path
                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                        fill="#FBBC05"
                      />
                      <path
                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                        fill="#EA4335"
                      />
                    </svg>
                    Entrar com o Google
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Footer text below card */}
          <p className="mt-6 text-center text-sm text-gray-500">
            Não tem conta?{" "}
            <a
              href="/auth/registro"
              className="font-medium text-primary hover:text-primary-hover transition-colors"
            >
              Cadastre-se
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
