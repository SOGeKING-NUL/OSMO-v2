'use client';

// Shared wallet state for every /app route. Lives in the /app layout so the
// connection survives navigation between tabs, and (via reconnectWallet)
// silently restores after a full page refresh.

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import {
  addTrustlines as apiAddTrustlines,
  connectWallet,
  getMissingTrustlines,
  reconnectWallet,
} from "@/lib/folio";

/** localStorage flag: this browser connected before, so restore silently on load. */
const WALLET_KEY = "osmo-wallet-connected";

type Trustline = { code: string; issuer: string };

interface WalletCtx {
  address: string;
  missingTrustlines: Trustline[];
  connect: () => Promise<void>;
  refreshTrustlines: () => Promise<void>;
  /** Add the currently-missing trustlines in one signed tx, then refresh. */
  addMissingTrustlines: () => Promise<void>;
}

const Ctx = createContext<WalletCtx | null>(null);

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const [address, setAddress] = useState("");
  const [missingTrustlines, setMissingTrustlines] = useState<Trustline[]>([]);

  const refreshTrustlines = useCallback(async () => {
    if (!address) return;
    setMissingTrustlines(await getMissingTrustlines(address));
  }, [address]);

  const connect = useCallback(async () => {
    const addr = await connectWallet();
    setAddress(addr);
    localStorage.setItem(WALLET_KEY, "1");
    // classic assets (everything but XLM) need a trustline before this wallet
    // can hold them - a fresh account almost certainly lacks these
    setMissingTrustlines(await getMissingTrustlines(addr));
  }, []);

  const addMissingTrustlines = useCallback(async () => {
    if (!address || missingTrustlines.length === 0) return;
    await apiAddTrustlines(address, missingTrustlines);
    setMissingTrustlines(await getMissingTrustlines(address));
  }, [address, missingTrustlines]);

  // Silent restore after a refresh: only when this browser connected before,
  // and reconnectWallet never opens a Freighter popup.
  useEffect(() => {
    if (!localStorage.getItem(WALLET_KEY)) return;
    reconnectWallet()
      .then(async (addr) => {
        if (!addr) return;
        setAddress(addr);
        setMissingTrustlines(await getMissingTrustlines(addr));
      })
      .catch(() => {});
  }, []);

  return (
    <Ctx.Provider value={{ address, missingTrustlines, connect, refreshTrustlines, addMissingTrustlines }}>
      {children}
    </Ctx.Provider>
  );
}

export function useWallet(): WalletCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useWallet must be used within <WalletProvider>");
  return ctx;
}
