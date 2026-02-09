"use client";

import { cn } from "@/lib/cn";

interface FilterPillOption<T extends string = string> {
  key: T;
  label: string;
  count?: number;
}

interface FilterPillGroupProps<T extends string = string> {
  options: FilterPillOption<T>[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
}

export function FilterPillGroup<T extends string = string>({
  options,
  value,
  onChange,
  className,
}: FilterPillGroupProps<T>) {
  return (
    <div className={cn("flex flex-wrap items-center gap-1.5", className)}>
      {options.map((opt) => (
        <button
          key={opt.key}
          onClick={() => onChange(opt.key)}
          className={cn(
            "px-3 py-1.5 text-xs font-medium rounded-full transition-colors",
            value === opt.key
              ? "bg-gray-900 text-white"
              : "bg-gray-100 text-gray-600 hover:bg-gray-200"
          )}
        >
          {opt.label}
          {opt.count !== undefined && (
            <span
              className={cn(
                "ml-1.5 text-xs tabular-nums",
                value === opt.key ? "text-gray-400" : "text-gray-400"
              )}
            >
              {opt.count}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}
