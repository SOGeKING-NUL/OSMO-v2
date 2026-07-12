// Small display primitives shared across the /app routes.

import { TOKEN_INFO } from "@/lib/config";
import { AssetInfo } from "@/lib/folio";
import { cn } from "@/lib/utils";

export function tokenSymbol(id: string): string {
  return TOKEN_INFO[id]?.symbol ?? `${id.slice(0, 4)}…${id.slice(-4)}`;
}

export const cardClass =
  "rounded-2xl border border-black/6 bg-white shadow-[0_1px_2px_rgba(19,35,71,0.04)] mt-4";

export function PageHeader({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="pt-1">
      <h1 className="font-heading text-3xl font-bold tracking-tight text-[#0b1428] sm:text-4xl">
        {title}
      </h1>
      {subtitle && (
        <p className="mt-2.5 max-w-2xl text-sm leading-relaxed text-gray-500">
          {subtitle}
        </p>
      )}
    </div>
  );
}

export function Donut({ assets }: { assets: AssetInfo[] }) {
  const R = 42;
  const C = 2 * Math.PI * R;
  let offset = 0;
  return (
    <div className="relative shrink-0">
      <svg
        viewBox="0 0 100 100"
        className="h-32 w-32 -rotate-90"
        role="img"
        aria-label="Basket composition"
      >
        <circle cx="50" cy="50" r={R} fill="none" stroke="#0000000a" strokeWidth="10" />
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
              strokeWidth="10"
              strokeDasharray={`${frac * C} ${C}`}
              strokeDashoffset={-offset}
              strokeLinecap="butt"
            />
          );
          offset += frac * C;
          return seg;
        })}
      </svg>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-heading text-2xl font-bold leading-none text-[#0b1428]">
          {assets.length || "—"}
        </span>
        <span className="mt-0.5 text-[10px] font-medium uppercase tracking-wider text-gray-400">
          assets
        </span>
      </div>
    </div>
  );
}

export function Dot({ color }: { color?: string }) {
  return (
    <span
      className="mr-2 inline-block h-2.5 w-2.5 rounded-full align-middle"
      style={{ background: color ?? "#888" }}
    />
  );
}

export function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div>
      <div className="text-[11px] font-medium uppercase tracking-wider text-gray-400">
        {label}
      </div>
      <div
        className={cn(
          "font-heading mt-1.5 text-2xl font-bold tabular-nums sm:text-3xl",
          accent ? "text-[#1f4fb4]" : "text-[#0b1428]",
        )}
      >
        {value}
      </div>
    </div>
  );
}

export function StatCard(props: { label: string; value: string; accent?: boolean }) {
  return (
    <div className={cn(cardClass, "px-6 py-5")}>
      <Stat {...props} />
    </div>
  );
}
