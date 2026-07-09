"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ScrollLink } from "@/components/landing/scroll-link";

export function Hero() {
  const [parallax, setParallax] = useState({ x: 0, y: 0 });

  const onMouseMove = useCallback((e: React.MouseEvent<HTMLElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    setParallax({
      x: ((e.clientX - r.left) / r.width - 0.5) * 2,
      y: ((e.clientY - r.top) / r.height - 0.5) * 2,
    });
  }, []);

  return (
    <section onMouseMove={onMouseMove}>
      <div className="relative">
        <h1 className="font-heading mt-8 max-w-3xl text-6xl font-bold leading-[1.02] tracking-tighter">
          ONE DEPOSIT.
          <br />
          THE WHOLE
          <br />
          STELLAR BASKET.
        </h1>

        <div className="mt-20 flex flex-wrap justify-between gap-10">
          <div className="max-w-md">
            <Button
              asChild
              variant="outline"
              className="rounded-full border-2 border-black bg-white/70 px-8 backdrop-blur transition-shadow hover:shadow-[0_0_24px_rgba(31,79,180,0.3)]"
            >
              <Link href="/app">LAUNCH THE APP</Link>
            </Button>
            <p className="mt-8 text-sm leading-relaxed text-gray-700">
              OSMO IS A DIVERSIFIED TOKEN FOLIO (DTF) ON STELLAR.
              <br />
              FIVE ECOSYSTEM ASSETS. ONE TOKEN: SEF.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
