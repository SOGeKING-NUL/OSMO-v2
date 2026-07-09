// SVG donut of target weights; the active slice thickens while others fade
// (driven by hover state in the basket section).

import type { Slice } from "@/components/landing/data";

export function Donut({ slices, active }: { slices: Slice[]; active: number | null }) {
  const R = 40;
  const C = 2 * Math.PI * R;
  let offset = 0;
  return (
    <div className="relative mx-auto h-64 w-64">
      <svg viewBox="0 0 100 100" className="h-full w-full" role="img" aria-label="Basket composition">
        {slices.map((s, i) => {
          const seg = (
            <circle
              key={i}
              cx="50"
              cy="50"
              r={R}
              fill="none"
              stroke={s.color}
              strokeWidth={active === i ? 14 : 11}
              strokeDasharray={`${Math.max(s.frac * C - 1.5, 0)} ${C}`}
              strokeDashoffset={-offset}
              transform="rotate(-90 50 50)"
              opacity={active === null || active === i ? 1 : 0.25}
              style={{ transition: "opacity .25s, stroke-width .25s" }}
            />
          );
          offset += s.frac * C;
          return seg;
        })}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <div className="font-heading text-3xl font-bold">SEF</div>
        <div className="mt-1 text-[10px] uppercase tracking-[0.2em] text-gray-500">
          one token
          <br />
          five assets
        </div>
      </div>
    </div>
  );
}
