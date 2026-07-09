// Small display primitives shared across the /app routes.

import { TOKEN_INFO } from "@/lib/config";
import { AssetInfo } from "@/lib/folio";

export function tokenSymbol(id: string): string {
  return TOKEN_INFO[id]?.symbol ?? `${id.slice(0, 4)}…${id.slice(-4)}`;
}

/** SVG donut of target weights. */
export function Donut({ assets }: { assets: AssetInfo[] }) {
  const R = 40;
  const C = 2 * Math.PI * R;
  let offset = 0;
  return (
    <svg viewBox="0 0 100 100" className="h-32 w-32 shrink-0" role="img" aria-label="Basket composition">
      {assets.map((a) => {
        const frac = a.weight_bps / 10_000;
        const seg = (
          <circle
            key={a.token}
            cx="50"
            cy="50"
            r={R}
            fill="none"
            stroke={TOKEN_INFO[a.token]?.color ?? "#888"}
            strokeWidth="14"
            strokeDasharray={`${frac * C} ${C}`}
            strokeDashoffset={-offset}
            transform="rotate(-90 50 50)"
          />
        );
        offset += frac * C;
        return seg;
      })}
    </svg>
  );
}

/** Small colored dot used in tables to key a row to its token color. */
export function Dot({ color }: { color?: string }) {
  return (
    <span
      className="mr-1.5 inline-block h-2.5 w-2.5 rounded-full align-middle"
      style={{ background: color ?? "#888" }}
    />
  );
}

export function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-1 text-2xl font-semibold tabular-nums">{value}</div>
    </div>
  );
}
