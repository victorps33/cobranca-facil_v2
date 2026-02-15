"use client";

import Image from "next/image";
import { cn } from "@/lib/cn";

type MenloLogoProps = {
  className?: string;
  variant?: "sidebar" | "default";
  size?: "sm" | "md";
  priority?: boolean;
};

const sizes = {
  sm: { w: 120, h: 30 },
  md: { w: 148, h: 36 },
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

  // When collapsed (sm), show only the icon mark
  if (size === "sm") {
    return (
      <Image
        src="/menlo-icon.png"
        alt="Menlo"
        width={44}
        height={44}
        priority={priority}
        className={cn("select-none mix-blend-multiply dark:mix-blend-screen dark:invert", className)}
      />
    );
  }

  const { w, h } = sizes[size];

  return (
    <Image
      src={src}
      alt="Menlo"
      width={w}
      height={h}
      priority={priority}
      className={cn(blendClass, className)}
    />
  );
}
