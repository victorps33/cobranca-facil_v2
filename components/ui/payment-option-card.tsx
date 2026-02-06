"use client";

import { cn } from "@/lib/cn";
import { LucideIcon, Check } from "lucide-react";

interface PaymentOptionCardProps {
  id: string;
  icon: LucideIcon;
  title: string;
  description: string;
  fee?: string;
  timing?: string;
  selected: boolean;
  disabled?: boolean;
  onSelect: (id: string) => void;
}

export function PaymentOptionCard({
  id,
  icon: Icon,
  title,
  description,
  fee,
  timing,
  selected,
  disabled = false,
  onSelect,
}: PaymentOptionCardProps) {
  return (
    <button
      type="button"
      onClick={() => !disabled && onSelect(id)}
      disabled={disabled}
      className={cn(
        "relative w-full text-left p-4 rounded-xl border-2 transition-[border-color,box-shadow]",
        selected
          ? "border-[#F85B00] bg-[#F85B00]/5"
          : "border-gray-200 hover:border-gray-300",
        disabled && "opacity-50 cursor-not-allowed bg-gray-50"
      )}
    >
      {/* Selected indicator */}
      {selected && (
        <div className="absolute top-3 right-3 h-5 w-5 rounded-full bg-[#F85B00] flex items-center justify-center">
          <Check className="h-3 w-3 text-white" />
        </div>
      )}

      <div className="flex items-start gap-4">
        <div
          className={cn(
            "h-12 w-12 rounded-xl flex items-center justify-center flex-shrink-0",
            selected ? "bg-[#F85B00]/10" : "bg-gray-100"
          )}
        >
          <Icon
            className={cn(
              "h-6 w-6",
              selected ? "text-[#F85B00]" : "text-gray-500"
            )}
            strokeWidth={1.5}
          />
        </div>

        <div className="flex-1 min-w-0">
          <h4 className="font-semibold text-gray-900">{title}</h4>
          <p className="text-sm text-gray-500 mt-0.5">{description}</p>

          {(fee || timing) && (
            <div className="flex flex-wrap gap-3 mt-2">
              {fee && (
                <span className="inline-flex items-center px-2 py-1 rounded-md bg-gray-100 text-xs text-gray-600">
                  Taxa: {fee}
                </span>
              )}
              {timing && (
                <span className="inline-flex items-center px-2 py-1 rounded-md bg-blue-50 text-xs text-blue-600">
                  {timing}
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </button>
  );
}
