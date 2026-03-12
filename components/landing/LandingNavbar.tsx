"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { MenloLogo } from "@/components/brand/MenloLogo";

export function LandingNavbar() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 transition-colors duration-300 ${
        scrolled ? "bg-menlo-offwhite/95 backdrop-blur-sm shadow-soft" : "bg-transparent"
      }`}
    >
      <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
        <Link href="/landing">
          <MenloLogo variant="default" size="md" />
        </Link>
        <Link
          href="/auth/login"
          className="text-sm font-medium text-gray-600 hover:text-menlo-orange transition-colors"
        >
          Login
        </Link>
      </div>
    </nav>
  );
}
