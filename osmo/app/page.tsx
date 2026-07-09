'use client';

// Landing page — thin composition; each section lives in components/landing/.

import { BasketSection } from "@/components/landing/basket";
import { Cta } from "@/components/landing/cta";
import { buildBasketRows, buildSlices, buildTickerItems } from "@/components/landing/data";
import { Features } from "@/components/landing/features";
import { Footer } from "@/components/landing/footer";
import { Hero } from "@/components/landing/hero";
import { HowItWorks } from "@/components/landing/how-it-works";
import { Navbar } from "@/components/landing/navbar";
import { Stats } from "@/components/landing/stats";
import { Ticker } from "@/components/landing/ticker";
import { useLiveFolio } from "@/hooks/use-live-folio";

export default function Home() {
  const { assets, prices, nav, supply } = useLiveFolio();

  return (
    <div className="min-h-screen overflow-x-clip bg-[#f8f8f8]">
      <Navbar />
      {/* spacer under the fixed navbar */}
      <div className="h-20" aria-hidden="true" />

      <main className="relative px-6 pb-24 pt-8 ">
        <Hero />

        <div className="relative">
          <Stats nav={nav} supply={supply} />
          <Ticker items={buildTickerItems(assets, prices)} />
          <BasketSection slices={buildSlices(assets)} rows={buildBasketRows(assets, prices)} />
          <HowItWorks />
          <Features />
          <Cta />
        </div>
      </main>

      <Footer />
    </div>
  );
}
