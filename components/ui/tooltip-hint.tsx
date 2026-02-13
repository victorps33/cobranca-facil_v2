"use client";

import { useState, ReactNode } from "react";
import { HelpCircle } from "lucide-react";
import { cn } from "@/lib/cn";

interface TooltipHintProps {
  text: string;
  children?: ReactNode;
  className?: string;
}

export function TooltipHint({ text, children, className }: TooltipHintProps) {
  const [show, setShow] = useState(false);

  return (
    <span
      className={cn("relative inline-flex items-center", className)}
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
    >
      {children || (
        <HelpCircle className="h-3.5 w-3.5 text-gray-400 hover:text-gray-600 cursor-help transition-colors" />
      )}
      {show && (
        <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1.5 text-xs text-white bg-gray-900 rounded-lg whitespace-nowrap shadow-large z-50 pointer-events-none">
          {text}
          <span className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900" />
        </span>
      )}
    </span>
  );
}
