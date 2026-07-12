// Live protocol stats — NAV/share, TVL and supply read from the folio contract.

import { PRICE_DECIMALS, SHARE_DECIMALS } from "@/lib/config";
import { NavInfo, fmtUnits } from "@/lib/folio";
import { Reveal } from "@/components/landing/reveal";

export function Stats({ nav, supply }: { nav: NavInfo | null; supply: bigint | null }) {
  const stats = [
    {
      label: "NAV / SHARE",
      value: nav ? `$${fmtUnits(nav.per_share, PRICE_DECIMALS, 6)}` : null,
      live: !!nav,
      // NAV can only be priced when every oracle feed is fresh; the folio's
      // staleness guard reverts nav() rather than serving a stale valuation.
      note: "awaiting oracle feed",
    },
    {
      label: "TOTAL VALUE LOCKED",
      value: nav ? `$${fmtUnits(nav.total_value, PRICE_DECIMALS, 2)}` : null,
      live: !!nav,
      note: "awaiting oracle feed",
    },
    {
      label: "SHARES OUTSTANDING",
      value: supply !== null ? fmtUnits(supply, SHARE_DECIMALS, 2) : null,
      live: supply !== null,
      note: "SEF shares minted",
    },
  ];

  return (
    <Reveal className="mt-20">
      <div className="grid gap-4 sm:grid-cols-3">
        {stats.map((s, i) => (
          <div
            key={s.label}
            className="rounded-2xl border border-black/10 bg-white/90 p-6 shadow-sm backdrop-blur transition hover:-translate-y-0.5 hover:border-[#1f4fb4]/40 hover:shadow-md"
            style={{ transitionDelay: `${i * 60}ms` }}
          >
            <div className="flex items-center gap-2 text-[11px] tracking-[0.2em] text-gray-500">
              {s.label}
              {s.live && (
                <span className="relative flex h-1.5 w-1.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-60" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
                </span>
              )}
            </div>
            {s.value !== null ? (
              <>
                <div className="font-heading mt-3 text-3xl font-bold tabular-nums">{s.value}</div>
                {s.label === "SHARES OUTSTANDING" && (
                  <div className="mt-1 text-[11px] text-gray-400">{s.note}</div>
                )}
              </>
            ) : (
              <div className="mt-3 flex items-center gap-2 text-sm font-medium text-gray-400">
                <span className="h-2 w-2 animate-pulse rounded-full bg-amber-400" />
                {s.note}
              </div>
            )}
          </div>
        ))}
      </div>
      <p className="mt-2 text-right text-[11px] text-gray-400">
        READ LIVE FROM THE FOLIO CONTRACT · REFRESHES EVERY 15S
      </p>
    </Reveal>
  );
}
