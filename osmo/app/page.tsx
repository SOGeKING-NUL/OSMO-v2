'use client';

// Landing page — thin composition; each section lives in components/landing/.

import { motion } from "motion/react";
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
  const { assets, prices, nav, supply, balances } = useLiveFolio();

  return (
    <div className="relative min-h-screen overflow-x-clip bg-[#f8f8f8]">
      {/* Top-right motif — was a static CSS background that popped in abruptly
          on every return to the landing page; now an element that eases in. */}
      <motion.img
        src="/landing.png"
        alt=""
        aria-hidden="true"
        initial={{ opacity: 0, x: 48, y: -28, scale: 1.06 }}
        animate={{ opacity: 1, x: 0, y: 0, scale: 1 }}
        transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1], delay: 0.1 }}
        className="pointer-events-none absolute right-0 top-0 z-0 w-[min(45vw,580px)] select-none"
      />

      <Navbar />
      {/* spacer under the fixed navbar */}
      <div className="h-20" aria-hidden="true" />

      <main className="relative z-10 px-6 pb-24 pt-8 ">
        <Hero />

        <div className="relative">
          <Stats nav={nav} supply={supply} />
          <Ticker items={buildTickerItems(assets, prices, balances)} />
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
