"use client";

import { cn } from "@/lib/cn";
import { LucideIcon, ChevronRight } from "lucide-react";

interface InsightCardProps {
  title: string;
  subtitle: string;
  icon: LucideIcon;
  iconColor: string;
  iconBgColor: string;
  onClick?: () => void;
}

export function InsightCard({
  title,
  subtitle,
  icon: Icon,
  iconColor,
  iconBgColor,
  onClick,
}: InsightCardProps) {
  return (
    <button
      onClick={onClick}
      className="w-full bg-white rounded-2xl border border-gray-100 p-5 text-left hover:border-gray-200 hover:shadow-md transition-[border-color,box-shadow] group"
    >
      <div className="flex items-start gap-4">
        <div
          className={cn(
            "h-11 w-11 rounded-xl flex items-center justify-center flex-shrink-0",
            iconBgColor
          )}
        >
          <Icon className={cn("h-5 w-5", iconColor)} />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-gray-900 group-hover:text-primary transition-colors">
            {title}
          </h3>
          <p className="text-sm text-gray-500 mt-0.5">{subtitle}</p>
        </div>
        <ChevronRight className="h-5 w-5 text-gray-300 group-hover:text-primary group-hover:translate-x-0.5 transition-transform flex-shrink-0" />
      </div>
    </button>
  );
}
