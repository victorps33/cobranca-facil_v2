import { cn } from "@/lib/cn";

interface MenloLogoProps {
  variant?: "full" | "icon";
  color?: "dark" | "light";
  size?: "sm" | "md" | "lg";
  className?: string;
}

export function MenloLogo({ 
  variant = "full", 
  color = "dark", 
  size = "md",
  className 
}: MenloLogoProps) {
  const sizes = {
    sm: { icon: 32, text: "text-lg" },
    md: { icon: 40, text: "text-xl" },
    lg: { icon: 52, text: "text-2xl" },
  };

  const colors = {
    dark: {
      stroke: "#000000",
      text: "#000000",
    },
    light: {
      stroke: "#FFFFFF",
      text: "#FFFFFF",
    },
  };

  const { icon: iconSize, text: textSize } = sizes[size];
  const { stroke, text: textColor } = colors[color];

  return (
    <div className={cn("flex items-center gap-2", className)}>
      {/* Menlo Icon - Two connected arches forming "m" */}
      <svg 
        width={iconSize} 
        height={iconSize * 0.7} 
        viewBox="0 0 56 36" 
        fill="none" 
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Left arch with descender */}
        <path 
          d="M4 32V16C4 9.37258 9.37258 4 16 4C22.6274 4 28 9.37258 28 16V20C28 26.6274 33.3726 32 40 32"
          stroke={stroke} 
          strokeWidth="4" 
          strokeLinecap="round" 
          strokeLinejoin="round"
          fill="none"
        />
        {/* Left vertical descender */}
        <path 
          d="M16 32V22"
          stroke={stroke} 
          strokeWidth="4" 
          strokeLinecap="round"
          fill="none"
        />
        {/* Right arch with ascender */}
        <path 
          d="M28 16C28 9.37258 33.3726 4 40 4C46.6274 4 52 9.37258 52 16V32"
          stroke={stroke} 
          strokeWidth="4" 
          strokeLinecap="round" 
          strokeLinejoin="round"
          fill="none"
        />
        {/* Right vertical ascender */}
        <path 
          d="M40 14V4"
          stroke={stroke} 
          strokeWidth="4" 
          strokeLinecap="round"
          fill="none"
        />
      </svg>

      {/* Text */}
      {variant === "full" && (
        <span 
          className={cn("font-bold tracking-tight", textSize)}
          style={{ color: textColor }}
        >
          menlo
        </span>
      )}
    </div>
  );
}
