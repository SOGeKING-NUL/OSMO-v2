'use client';

// Live chain data for the landing page — same read-only client the app uses.
// Fetches assets, NAV, supply, folio holdings and per-asset prices on mount;
// the oracle-gated reads (nav + prices) and holdings refresh every 15s.
// Everything degrades to null/[] if the chain (or oracle) is unreachable.

import { useEffect, useRef, useState } from "react";
import {
  AssetInfo,
  NavInfo,
  PriceData,
  fetchAssetPrices,
  fetchAssets,
  fetchBalances,
  fetchNav,
  fetchTotalSupply,
} from "@/lib/folio";

export function useLiveFolio() {
  const [assets, setAssets] = useState<AssetInfo[]>([]);
  const [prices, setPrices] = useState<Record<string, PriceData | null>>({});
  const [nav, setNav] = useState<NavInfo | null>(null);
  const [supply, setSupply] = useState<bigint | null>(null);
  // Folio's on-chain token holdings — read straight from the contract, so they
  // stay live even when the oracle guard trips and nav()/price() revert.
  const [balances, setBalances] = useState<bigint[] | null>(null);
  // Latest basket token list, so the refresh interval can re-price without
  // being re-created when assets land.
  const tokensRef = useRef<string[]>([]);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const a = await fetchAssets();
        if (!alive) return;
        setAssets(a);
        tokensRef.current = a.map((x) => x.token);
        const [n, s, b, p] = await Promise.all([
          fetchNav().catch(() => null),
          fetchTotalSupply().catch(() => null),
          fetchBalances().catch(() => null),
          fetchAssetPrices(a.map((x) => x.token)).catch(
            () => ({}) as Record<string, PriceData | null>,
          ),
        ]);
        if (!alive) return;
        setNav(n);
        setSupply(s);
        setBalances(b);
        setPrices(p);
      } catch {
        /* chain unreachable — static fallbacks render */
      }
    })();
    // Oracle-gated reads (nav + prices) refresh together on the 15s cadence
    // advertised in the UI; balances ride along since they're cheap.
    const t = setInterval(() => {
      if (!alive) return;
      fetchNav().then((n) => alive && setNav(n)).catch(() => {});
      fetchBalances().then((b) => alive && setBalances(b)).catch(() => {});
      if (tokensRef.current.length)
        fetchAssetPrices(tokensRef.current)
          .then((p) => alive && setPrices(p))
          .catch(() => {});
    }, 15000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, []);

  return { assets, prices, nav, supply, balances };
}
