"use client";

import { cn } from "@/lib/cn";
import { ReactNode } from "react";

interface DashboardTileProps {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}

export function DashboardTile({
  title,
  subtitle,
  action,
  children,
  className,
}: DashboardTileProps) {
  return (
    <div
      className={cn(
        "bg-white rounded-2xl border border-gray-100 flex flex-col h-[420px] w-full",
        className
      )}
    >
      {/* Header - fixed height */}
      <div className="flex items-center justify-between px-6 py-5 border-b border-gray-50 min-h-[72px]">
        <div>
          <h3 className="font-semibold text-gray-900">{title}</h3>
          {subtitle && (
            <p className="text-sm text-gray-500 mt-0.5">{subtitle}</p>
          )}
        </div>
        {action}
      </div>
      {/* Content - flexible */}
      <div className="flex-1 min-h-0 p-6">
        {children}
      </div>
    </div>
  );
}
