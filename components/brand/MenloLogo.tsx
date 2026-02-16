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
    <>
      {/* Icon — always in DOM, toggled via hidden/block */}
      <Image
        src="/menlo-icon.png"
        alt="Menlo"
        width={44}
        height={44}
        priority={priority}
        className={cn(blendClass, isCollapsed ? "block" : "hidden", className)}
      />
      {/* Full logo — always in DOM, toggled via hidden/block */}
      <Image
        src={src}
        alt="Menlo"
        width={148}
        height={36}
        priority={priority}
        className={cn(blendClass, isCollapsed ? "hidden" : "block", className)}
      />
    </>
  );
}
