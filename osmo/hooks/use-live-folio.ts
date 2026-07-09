'use client';

// Live chain data for the landing page — same read-only client the app uses.
// Fetches assets, NAV, supply and per-asset prices on mount; NAV refreshes
// every 15s. Everything degrades to null/[] if the chain is unreachable.

import { useEffect, useState } from "react";
import {
  AssetInfo,
  NavInfo,
  PriceData,
  fetchAssetPrices,
  fetchAssets,
  fetchNav,
  fetchTotalSupply,
} from "@/lib/folio";

export function useLiveFolio() {
  const [assets, setAssets] = useState<AssetInfo[]>([]);
  const [prices, setPrices] = useState<Record<string, PriceData | null>>({});
  const [nav, setNav] = useState<NavInfo | null>(null);
  const [supply, setSupply] = useState<bigint | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const a = await fetchAssets();
        if (!alive) return;
        setAssets(a);
        const [n, s, p] = await Promise.all([
          fetchNav().catch(() => null),
          fetchTotalSupply().catch(() => null),
          fetchAssetPrices(a.map((x) => x.token)).catch(
            () => ({}) as Record<string, PriceData | null>,
          ),
        ]);
        if (!alive) return;
        setNav(n);
        setSupply(s);
        setPrices(p);
      } catch {
        /* chain unreachable — static fallbacks render */
      }
    })();
    const t = setInterval(() => {
      fetchNav().then((n) => alive && setNav(n)).catch(() => {});
    }, 15000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, []);

  return { assets, prices, nav, supply };
}
