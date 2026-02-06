"use client";

import { cn } from "@/lib/cn";
import { SearchX } from "lucide-react";
import { ReactNode } from "react";

interface FilterEmptyStateProps {
  message?: string;
  onClear?: () => void;
  clearLabel?: string;
  icon?: ReactNode;
  className?: string;
}

export function FilterEmptyState({
  message = "Nenhum resultado para os filtros atuais.",
  onClear,
  clearLabel = "Limpar filtros",
  icon,
  className,
}: FilterEmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center py-16 text-center",
        className
      )}
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gray-100 mb-4">
        {icon || <SearchX className="h-6 w-6 text-gray-400" />}
      </div>
      <p className="text-sm text-gray-500 max-w-xs">{message}</p>
      {onClear && (
        <button
          onClick={onClear}
          className="mt-3 text-sm font-medium text-[#F85B00] hover:text-[#e05200] transition-colors"
        >
          {clearLabel}
        </button>
      )}
    </div>
  );
}
