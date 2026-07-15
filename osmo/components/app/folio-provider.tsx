'use client';

// Shared folio chain data for every /app route: assets, NAV, balances, supply,
// prices, pool reserves and the connected wallet's share balance. Polls every
// POLL_MS and re-fetches on demand via refresh() after a mint / deposit / drip.

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { POOLS } from "@/lib/config";
import {
  AssetInfo,
  NavInfo,
  PoolReserves,
  PriceData,
  fetchAssetPrices,
  fetchAssets,
  fetchBalances,
  fetchNav,
  fetchPoolReserves,
  fetchShareBalance,
  fetchTotalSupply,
} from "@/lib/folio";
import { useWallet } from "@/components/app/wallet-provider";

const POLL_MS = 5000;
const ORACLE_GUARD_MESSAGE =
  "Testnet oracle relay needs a refresh. NAV is paused by the contract's staleness guard, while balances and redeemable folio assets remain readable.";

interface FolioCtx {
  assets: AssetInfo[];
  nav: NavInfo | null;
  balances: bigint[];
  supply: bigint;
  prices: Record<string, PriceData | null>;
  pools: Record<string, PoolReserves | null>;
  myShares: bigint;
  navError: string;
  refresh: () => Promise<void>;
}

const Ctx = createContext<FolioCtx | null>(null);

export function FolioProvider({ children }: { children: React.ReactNode }) {
  const { address } = useWallet();
  const [assets, setAssets] = useState<AssetInfo[]>([]);
  const [nav, setNav] = useState<NavInfo | null>(null);
  const [balances, setBalances] = useState<bigint[]>([]);
  const [supply, setSupply] = useState<bigint>(0n);
  const [prices, setPrices] = useState<Record<string, PriceData | null>>({});
  const [pools, setPools] = useState<Record<string, PoolReserves | null>>({});
  const [myShares, setMyShares] = useState<bigint>(0n);
  const [navError, setNavError] = useState<string>("");

  const refresh = useCallback(async () => {
    const [navResult, balancesResult, supplyResult] = await Promise.allSettled([
      fetchNav(),
      fetchBalances(),
      fetchTotalSupply(),
    ]);

    if (navResult.status === "fulfilled") {
      setNav(navResult.value);
      setNavError("");
    } else {
      setNav(null);
      setNavError(ORACLE_GUARD_MESSAGE);
    }

    if (balancesResult.status === "fulfilled") {
      setBalances(balancesResult.value);
    }

    if (supplyResult.status === "fulfilled") {
      setSupply(supplyResult.value);
    }

    if (address) {
      fetchShareBalance(address).then(setMyShares).catch(() => {});
    } else {
      setMyShares(0n);
    }

    if (assets.length) {
      fetchAssetPrices(assets.map((a) => a.token)).then(setPrices);
    }
    Promise.all(POOLS.map((p) => fetchPoolReserves(p.id))).then((rs) =>
      setPools(Object.fromEntries(POOLS.map((p, i) => [p.id, rs[i]]))),
    );
  }, [address, assets]);

  useEffect(() => {
    fetchAssets().then(setAssets).catch(() => {});
  }, []);

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, POLL_MS);
    return () => clearInterval(t);
  }, [refresh]);

  return (
    <Ctx.Provider
      value={{ assets, nav, balances, supply, prices, pools, myShares, navError, refresh }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useFolio(): FolioCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useFolio must be used within <FolioProvider>");
  return ctx;
}
