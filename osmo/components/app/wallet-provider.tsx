'use client';

// Site-wide wallet state. Lives in the ROOT layout so the connection (and the
// connect modal) are available from the landing pages and every /app route,
// and survive navigation. reconnectWallet() silently restores after a full
// page refresh without opening a Freighter popup.

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
  isConnected: boolean;
  connecting: boolean;
  error: string;
  missingTrustlines: Trustline[];
  /** Perform the actual Freighter connect (opens the extension). */
  connect: () => Promise<void>;
  disconnect: () => void;
  refreshTrustlines: () => Promise<void>;
  /** Add the currently-missing trustlines in one signed tx, then refresh. */
  addMissingTrustlines: () => Promise<void>;
  // --- connect-wallet modal ---
  isModalOpen: boolean;
  /** Open the modal. Pass a href to navigate to once the wallet connects. */
  openModal: (pendingHref?: string) => void;
  closeModal: () => void;
  pendingHref: string | null;
  clearPendingHref: () => void;
}

const Ctx = createContext<WalletCtx | null>(null);

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const [address, setAddress] = useState("");
  const [missingTrustlines, setMissingTrustlines] = useState<Trustline[]>([]);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [pendingHref, setPendingHref] = useState<string | null>(null);

  const refreshTrustlines = useCallback(async () => {
    if (!address) return;
    setMissingTrustlines(await getMissingTrustlines(address));
  }, [address]);

  const connect = useCallback(async () => {
    setConnecting(true);
    setError("");
    try {
      const addr = await connectWallet();
      setAddress(addr);
      localStorage.setItem(WALLET_KEY, "1");
      // classic assets (everything but XLM) need a trustline before this wallet
      // can hold them - a fresh account almost certainly lacks these
      setMissingTrustlines(await getMissingTrustlines(addr));
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg || "Could not connect. Is Freighter installed and unlocked?");
      throw e;
    } finally {
      setConnecting(false);
    }
  }, []);

  const disconnect = useCallback(() => {
    setAddress("");
    setMissingTrustlines([]);
    setError("");
    localStorage.removeItem(WALLET_KEY);
  }, []);

  const addMissingTrustlines = useCallback(async () => {
    if (!address || missingTrustlines.length === 0) return;
    await apiAddTrustlines(address, missingTrustlines);
    setMissingTrustlines(await getMissingTrustlines(address));
  }, [address, missingTrustlines]);

  const openModal = useCallback((href?: string) => {
    setError("");
    setPendingHref(href ?? null);
    setIsModalOpen(true);
  }, []);
  const closeModal = useCallback(() => setIsModalOpen(false), []);
  const clearPendingHref = useCallback(() => setPendingHref(null), []);

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
    <Ctx.Provider
      value={{
        address,
        isConnected: !!address,
        connecting,
        error,
        missingTrustlines,
        connect,
        disconnect,
        refreshTrustlines,
        addMissingTrustlines,
        isModalOpen,
        openModal,
        closeModal,
        pendingHref,
        clearPendingHref,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useWallet(): WalletCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useWallet must be used within <WalletProvider>");
  return ctx;
}
