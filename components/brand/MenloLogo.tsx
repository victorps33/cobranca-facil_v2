"use client";

import Image from "next/image";
import { cn } from "@/lib/cn";

type MenloLogoProps = {
  className?: string;
  variant?: "sidebar" | "default";
  size?: "sm" | "md";
  priority?: boolean;
};

export function MenloLogo({
  className,
  variant = "sidebar",
  size = "md",
  priority = true,
}: MenloLogoProps) {
  const src =
    variant === "sidebar"
      ? "/menlo-logo-sidebar.png"
      : "/menlo-logo.png";

  const blendClass = "select-none mix-blend-multiply dark:mix-blend-screen dark:invert";
  const isCollapsed = size === "sm";

  return (
    <div className={cn("relative overflow-hidden", isCollapsed ? "w-[44px] h-[44px]" : "w-[148px] h-[36px]", className)}>
      {/* Icon (collapsed) — always rendered, toggled via opacity */}
      <Image
        src="/menlo-icon.png"
        alt="Menlo"
        width={44}
        height={44}
        priority={priority}
        className={cn(
          blendClass,
          "absolute top-0 left-0 transition-opacity duration-150",
          isCollapsed ? "opacity-100" : "opacity-0"
        )}
      />
      {/* Full logo (expanded) — always rendered, toggled via opacity */}
      <Image
        src={src}
        alt="Menlo"
        width={148}
        height={36}
        priority={priority}
        className={cn(
          blendClass,
          "absolute top-0 left-0 transition-opacity duration-150",
          isCollapsed ? "opacity-0" : "opacity-100"
        )}
      />
    </div>
  );
}
