"use client";

import Link from "next/link";
import { cn } from "@/lib/cn";
import { SearchX } from "lucide-react";
import { ReactNode } from "react";

interface FilterEmptyStateProps {
  message?: string;
  suggestion?: string;
  onClear?: () => void;
  clearLabel?: string;
  actionLabel?: string;
  actionHref?: string;
  icon?: ReactNode;
  className?: string;
}

export function FilterEmptyState({
  message = "Nenhum resultado para os filtros atuais.",
  suggestion,
  onClear,
  clearLabel = "Limpar filtros",
  actionLabel,
  actionHref,
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
      {suggestion && (
        <p className="text-xs text-gray-400 mt-1.5 max-w-xs">{suggestion}</p>
      )}
      <div className="flex items-center gap-3 mt-4">
        {onClear && (
          <button
            onClick={onClear}
            className="text-sm font-medium text-gray-500 hover:text-gray-700 transition-colors"
          >
            {clearLabel}
          </button>
        )}
        {actionLabel && actionHref && (
          <Link
            href={actionHref}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-primary rounded-full hover:bg-primary-hover transition-colors"
          >
            {actionLabel}
          </Link>
        )}
      </div>
    </div>
  );
}
