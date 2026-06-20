import { Nav } from "@/components/marketing/nav";
import { Hero } from "@/components/marketing/hero";
import { Features } from "@/components/marketing/features";
import { HowItWorks } from "@/components/marketing/how-it-works";
import { PricingTeaser } from "@/components/marketing/pricing-teaser";
import { Footer } from "@/components/marketing/footer";

export default function Home() {
  return (
    <main>
      <Nav />
      <Hero />
      <Features />
      <HowItWorks />
      <PricingTeaser />
      <Footer />
    </main>
  );
}