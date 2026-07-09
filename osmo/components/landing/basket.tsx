'use client';

// The basket section: composition donut + per-asset rows with weight bars.
// Hovering a row highlights its donut slice and dims the others.

import { useState } from "react";
import { BasketRow, Slice } from "@/components/landing/data";
import { Donut } from "@/components/landing/donut";
import { Reveal } from "@/components/landing/reveal";
import { SectionLabel } from "@/components/landing/section-label";

export function BasketSection({ slices, rows }: { slices: Slice[]; rows: BasketRow[] }) {
  const [hovered, setHovered] = useState<number | null>(null);

  return (
    <section id="basket" className="mt-28 scroll-mt-28">
      <Reveal>
        <SectionLabel>THE BASKET</SectionLabel>
        <div className="mt-12 grid items-center gap-12 lg:grid-cols-2">
          <div className="relative overflow-hidden rounded-3xl border border-black/10 bg-white p-10 shadow-sm">
            <div
              className="halftone-light mask-fade-radial pointer-events-none absolute inset-0 opacity-30"
              aria-hidden="true"
            />
            <Donut slices={slices} active={hovered} />
          </div>
          <div>
            <h3 className="font-heading text-3xl font-bold tracking-tight">
              STELLAR ECOSYSTEM FOLIO
            </h3>
            <p className="mt-4 max-w-md text-sm leading-relaxed text-gray-600">
              A weighted index of the Stellar ecosystem: the native asset, DeFi tokens and
              stablecoins, held against target weights and priced by live oracle feeds. Hover an
              asset to see its slice.
            </p>
            <div className="mt-8 space-y-2">
              {rows.map((b, i) => (
                <div
                  key={b.symbol}
                  onMouseEnter={() => setHovered(i)}
                  onMouseLeave={() => setHovered(null)}
                  className={`cursor-default rounded-xl px-3 py-2.5 transition ${
                    hovered === i ? "bg-white shadow-sm" : ""
                  }`}
                >
                  <div className="flex items-baseline justify-between text-sm">
                    <span className="flex items-center gap-2 font-medium">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ background: b.color }} />
                      <span className="font-heading font-semibold">{b.symbol}</span>
                      {b.simulated && (
                        <span
                          className="text-[11px] text-amber-600/90"
                          title="No real oracle coverage, simulated price"
                        >
                          SIMULATED FEED
                        </span>
                      )}
                    </span>
                    <span className="tabular-nums text-gray-600">
                      {b.price} <span className="ml-2 text-gray-400">{b.weight.toFixed(0)}%</span>
                    </span>
                  </div>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-black/5">
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{
                        width: `${b.weight}%`,
                        background: b.color,
                        filter: hovered !== null && hovered !== i ? "saturate(0.3)" : undefined,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Reveal>
    </section>
  );
}
