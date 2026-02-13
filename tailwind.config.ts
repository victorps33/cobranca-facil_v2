import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Menlo Brand Colors
        menlo: {
          blue: "#85ace6",
          orange: "#F85B00",
          "orange-dark": "#e05200",
          black: "#000000",
          offwhite: "#F5F5F0",
          white: "#FFFFFF",
        },
        // Semantic Colors
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "#F85B00",
          foreground: "#FFFFFF",
          hover: "#e05200",
        },
        secondary: {
          DEFAULT: "#85ace6",
          foreground: "#000000",
          hover: "#6b9ad9",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        // Status Colors
        success: {
          DEFAULT: "#22c55e",
          bg: "#dcfce7",
          border: "#bbf7d0",
          text: "#166534",
        },
        warning: {
          DEFAULT: "#f59e0b",
          bg: "#fef3c7",
          border: "#fde68a",
          text: "#92400e",
        },
        danger: {
          DEFAULT: "#ef4444",
          bg: "#fee2e2",
          border: "#fecaca",
          text: "#991b1b",
        },
        info: {
          DEFAULT: "#85ace6",
          bg: "#dbeafe",
          border: "#bfdbfe",
          text: "#1e40af",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
        xl: "16px",
        "2xl": "20px",
        "3xl": "24px",
      },
      fontFamily: {
        sans: ["Poppins", "system-ui", "sans-serif"],
      },
      boxShadow: {
        soft: "0 2px 8px rgba(0, 0, 0, 0.04)",
        medium: "0 4px 12px rgba(0, 0, 0, 0.08)",
        large: "0 12px 28px rgba(0, 0, 0, 0.12)",
      },
      spacing: {
        "18": "4.5rem",
        "22": "5.5rem",
      },
      keyframes: {
        "fade-in-up": {
          from: { opacity: "0", transform: "translateY(12px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        "fade-in-up": "fade-in-up 0.5s cubic-bezier(0.16, 1, 0.3, 1) both",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;
