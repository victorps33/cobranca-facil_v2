"use client";

import { cn } from "@/lib/cn";
import { Search, X } from "lucide-react";

interface SearchBarProps {
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  size?: "sm" | "md";
  wrapperClassName?: string;
}

export function SearchBar({
  value,
  onValueChange,
  placeholder = "Buscar…",
  size = "md",
  wrapperClassName,
}: SearchBarProps) {
  const heightClass = size === "sm" ? "h-10" : "h-12";

  return (
    <div className={cn("relative", wrapperClassName)}>
      <Search
        className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400"
        aria-hidden="true"
      />
      <input
        type="search"
        aria-label={placeholder}
        value={value}
        onChange={(e) => onValueChange(e.target.value)}
        placeholder={placeholder}
        className={cn(
          heightClass,
          "w-full pl-10 pr-9 text-sm bg-white border border-gray-200 rounded-xl",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary/30 focus-visible:border-secondary transition-colors"
        )}
      />
      {value && (
        <button
          onClick={() => onValueChange("")}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          aria-label="Limpar busca"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}
