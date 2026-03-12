import { LandingNavbar } from "@/components/landing/LandingNavbar";
import { HeroSection } from "@/components/landing/HeroSection";
import { DemoAnimation } from "@/components/landing/DemoAnimation";
import { FeaturesSection } from "@/components/landing/FeaturesSection";
import { CTASection } from "@/components/landing/CTASection";

const DEMO_URL = "#"; // Replace with Calendly or booking URL

export default function LandingPage() {
  return (
    <>
      <LandingNavbar />
      <main>
        <HeroSection demoUrl={DEMO_URL} />
        <DemoAnimation />
        <FeaturesSection />
        <CTASection demoUrl={DEMO_URL} />
      </main>
    </>
  );
}
