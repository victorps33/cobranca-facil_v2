"use client";

import Link from "next/link";
import { cn } from "@/lib/cn";
import { Plus } from "lucide-react";
import { ReactNode } from "react";

interface ActionConfig {
  label: string;
  href?: string;
  onClick?: () => void;
  icon?: ReactNode;
  variant?: "primary" | "secondary";
}

interface PageHeaderProps {
  title: string;
  period?: string; // e.g. "Competência: Fev/26"
  primaryAction?: ActionConfig;
  secondaryActions?: ActionConfig[];
  children?: ReactNode;
  className?: string;
}

export function PageHeader({
  title,
  period,
  primaryAction,
  secondaryActions,
  children,
  className,
}: PageHeaderProps) {
  return (
    <div className={cn("flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between", className)}>
      {/* Left: title + period */}
      <div className="flex items-center gap-3 min-w-0">
        <h1 className="text-2xl font-bold text-gray-900 tracking-tight truncate">
          {title}
        </h1>
        {period && (
          <span className="text-xs text-gray-400 bg-gray-50 px-2 py-0.5 rounded-md">
            {period}
          </span>
        )}
      </div>

      {/* Right: actions */}
      <div className="flex items-center gap-2 mt-3 sm:mt-0 flex-shrink-0">
        {secondaryActions?.map((action, i) => {
          const content = (
            <>
              {action.icon}
              {action.label}
            </>
          );
          const cls =
            "inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-full hover:bg-gray-50 transition-colors";

          return action.href ? (
            <Link key={i} href={action.href} className={cls}>
              {content}
            </Link>
          ) : (
            <button key={i} onClick={action.onClick} className={cls}>
              {content}
            </button>
          );
        })}

        {primaryAction && (() => {
          const content = (
            <>
              {primaryAction.icon || <Plus className="h-4 w-4" />}
              {primaryAction.label}
            </>
          );
          const cls =
            "inline-flex items-center gap-1.5 px-5 py-2 text-sm font-medium text-white bg-primary rounded-full hover:bg-primary-hover transition-colors";

          return primaryAction.href ? (
            <Link href={primaryAction.href} className={cls}>
              {content}
            </Link>
          ) : (
            <button onClick={primaryAction.onClick} className={cls}>
              {content}
            </button>
          );
        })()}

        {children}
      </div>
    </div>
  );
}
