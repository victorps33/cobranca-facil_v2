"use client";

import { useEffect } from "react";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Dashboard error:", error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center py-20 space-y-4">
      <h2 className="text-lg font-semibold text-gray-900">
        Algo deu errado
      </h2>
      <p className="text-sm text-gray-500 max-w-md text-center">
        {error.message || "Ocorreu um erro inesperado."}
      </p>
      <button
        onClick={reset}
        className="px-4 py-2 text-sm font-medium text-white bg-primary rounded-full hover:bg-primary-hover transition-colors"
      >
        Tentar novamente
      </button>
    </div>
  );
}
