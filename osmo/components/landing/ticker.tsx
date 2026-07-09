// Market board: live basket prices in a segmented strip. Each asset gets a
// cell with its dot, symbol, oracle price and target weight.

import { TickerItem } from "@/components/landing/data";
import { Reveal } from "@/components/landing/reveal";

export function Ticker({ items }: { items: TickerItem[] }) {
  return (
    <Reveal>
      <div className="mt-16 overflow-hidden rounded-2xl border border-black/10 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-black/5 px-5 py-2.5">
          <span className="font-heading text-[11px] font-bold tracking-[0.2em] text-gray-500">
            LIVE ORACLE PRICES
          </span>
          <span className="flex items-center gap-1.5 text-[11px] tracking-widest text-gray-400">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-60" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
            </span>
            ON CHAIN
          </span>
        </div>
        <div className="grid grid-cols-2 divide-x divide-y divide-black/5 sm:grid-cols-3 lg:grid-cols-5 lg:divide-y-0">
          {items.map((it) => (
            <div key={it.symbol} className="group px-5 py-4 transition-colors hover:bg-[#1f4fb4]/[0.04]">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full" style={{ background: it.color }} />
                <span className="font-heading text-sm font-semibold">{it.symbol}</span>
              </div>
              <div className="font-heading mt-2 text-lg font-bold tabular-nums">{it.price}</div>
              <div className="mt-0.5 text-[11px] tracking-wide text-gray-400">
                TARGET {it.weight}
              </div>
            </div>
          ))}
        </div>
      </div>
    </Reveal>
  );
}
