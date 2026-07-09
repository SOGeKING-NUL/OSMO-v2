// Shared landing-page data: static basket fallback (instant paint before chain
// data lands) and builders that shape live chain data for each section.

import { PRICE_DECIMALS, TOKEN_INFO } from "@/lib/config";
import { AssetInfo, PriceData, fmtUnits } from "@/lib/folio";

// Palette drawn from the halftone bridge artwork: sky blue, international
// orange, cloud cream.
export const PRIMARY = "#1f4fb4";
export const SECONDARY = "#d95b21";
export const CREAM = "#f3e6c5";

export const BASKET_FALLBACK = [
  { symbol: "XLM", weight_bps: 4000, color: "#7b68ee" },
  { symbol: "tstAQUA", weight_bps: 2000, color: "#9f4ef5" },
  { symbol: "tstVELO", weight_bps: 1500, color: "#f5a623" },
  { symbol: "tstUSDC", weight_bps: 1500, color: "#2775ca" },
  { symbol: "tstEURC", weight_bps: 1000, color: "#1a9c6b" },
];

export function tokenSymbol(id: string): string {
  return TOKEN_INFO[id]?.symbol ?? `${id.slice(0, 4)}…${id.slice(-4)}`;
}

export interface Slice {
  color: string;
  frac: number;
}

export interface TickerItem {
  symbol: string;
  color: string;
  price: string;
  weight: string;
}

export interface BasketRow {
  symbol: string;
  color: string;
  weight: number;
  price: string;
  simulated?: boolean;
}

type Prices = Record<string, PriceData | null>;

export function buildSlices(assets: AssetInfo[]): Slice[] {
  return assets.length
    ? assets.map((a) => ({ color: TOKEN_INFO[a.token]?.color ?? "#888", frac: a.weight_bps / 10_000 }))
    : BASKET_FALLBACK.map((b) => ({ color: b.color, frac: b.weight_bps / 10_000 }));
}

export function buildTickerItems(assets: AssetInfo[], prices: Prices): TickerItem[] {
  return assets.length
    ? assets.map((a) => ({
        symbol: tokenSymbol(a.token),
        color: TOKEN_INFO[a.token]?.color ?? "#888",
        price: prices[a.token] ? `$${fmtUnits(prices[a.token]!.price, PRICE_DECIMALS, 4)}` : "···",
        weight: `${(a.weight_bps / 100).toFixed(0)}%`,
      }))
    : BASKET_FALLBACK.map((b) => ({
        symbol: b.symbol,
        color: b.color,
        price: "···",
        weight: `${b.weight_bps / 100}%`,
      }));
}

export function buildBasketRows(assets: AssetInfo[], prices: Prices): BasketRow[] {
  return assets.length
    ? assets.map((a) => ({
        symbol: tokenSymbol(a.token),
        color: TOKEN_INFO[a.token]?.color ?? "#888",
        weight: a.weight_bps / 100,
        price: prices[a.token] ? `$${fmtUnits(prices[a.token]!.price, PRICE_DECIMALS, 6)}` : "···",
        simulated: TOKEN_INFO[a.token]?.simulated,
      }))
    : BASKET_FALLBACK.map((b) => ({
        symbol: b.symbol,
        color: b.color,
        weight: b.weight_bps / 100,
        price: "···",
        simulated: b.symbol === "tstVELO",
      }));
}
