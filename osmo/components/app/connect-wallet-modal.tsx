"use client";

// Site-wide "Connect a wallet" modal, opened from any launch entry point via
// useWallet().openModal(). Freighter is the wired Stellar wallet; other popular
// Stellar wallets are shown as "Soon" so the picker reads like a modern
// multi-wallet modal (Uniswap / Reown AppKit) without offering dead options.

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useWallet } from "@/components/app/wallet-provider";
import { isFreighterAvailable } from "@/lib/folio";

type WalletOption = {
  id: string;
  name: string;
  tagline: string;
  color: string;
  glyph: React.ReactNode;
  soon?: boolean;
};

const WALLETS: WalletOption[] = [
  {
    id: "freighter",
    name: "Freighter",
    tagline: "Browser extension",
    color: "#f4a03c",
    glyph: (
      <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6">
        <path d="M12 2l8 4v6c0 4.4-3.2 8.3-8 9.6C7.2 20.3 4 16.4 4 12V6l8-4z" fill="currentColor" opacity="0.25" />
        <path d="M12 6.5l3.2 6.9-3.2-1.9-3.2 1.9L12 6.5z" fill="currentColor" />
      </svg>
    ),
  },
  {
    id: "xbull",
    name: "xBull",
    tagline: "Coming soon",
    color: "#12c2c2",
    soon: true,
    glyph: (
      <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6">
        <circle cx="12" cy="13" r="6" fill="currentColor" opacity="0.3" />
        <path d="M6 6l3 3M18 6l-3 3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    id: "albedo",
    name: "Albedo",
    tagline: "Coming soon",
    color: "#6b4ce6",
    soon: true,
    glyph: (
      <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6">
        <circle cx="12" cy="12" r="4" fill="currentColor" />
        <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.5" opacity="0.4" />
      </svg>
    ),
  },
  {
    id: "lobstr",
    name: "LOBSTR",
    tagline: "Coming soon",
    color: "#1b9de2",
    soon: true,
    glyph: (
      <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6">
        <path d="M12 4c3 0 5 2 5 5 0 4-5 11-5 11S7 13 7 9c0-3 2-5 5-5z" fill="currentColor" opacity="0.35" />
        <circle cx="12" cy="9" r="2" fill="currentColor" />
      </svg>
    ),
  },
];

const INSTALL_URL = "https://www.freighter.app/";

export function ConnectWalletModal() {
  const {
    isModalOpen,
    closeModal,
    connect,
    connecting,
    error,
    isConnected,
    pendingHref,
    clearPendingHref,
  } = useWallet();
  const router = useRouter();
  const [available, setAvailable] = useState<boolean | null>(null);
  const [selected, setSelected] = useState<string | null>(null);

  // Detect the extension whenever the modal opens.
  useEffect(() => {
    if (!isModalOpen) return;
    setSelected(null);
    setAvailable(null);
    isFreighterAvailable().then(setAvailable);
  }, [isModalOpen]);

  // Once connected: honor any pending navigation, then close.
  useEffect(() => {
    if (!isModalOpen || !isConnected) return;
    const href = pendingHref;
    clearPendingHref();
    closeModal();
    if (href) router.push(href);
  }, [isConnected, isModalOpen, pendingHref, clearPendingHref, closeModal, router]);

  // Escape to dismiss + lock body scroll while open.
  useEffect(() => {
    if (!isModalOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && closeModal();
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [isModalOpen, closeModal]);

  if (!isModalOpen) return null;

  const notInstalled = available === false;

  const onPick = (w: WalletOption) => {
    if (w.soon || connecting) return;
    setSelected(w.id);
    connect().catch(() => {});
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Connect a wallet"
    >
      {/* backdrop */}
      <button
        aria-label="Close"
        onClick={closeModal}
        className="absolute inset-0 cursor-default bg-[#0b1428]/40 backdrop-blur-sm animate-[fadeIn_.2s_ease-out]"
      />

      {/* card */}
      <div className="relative w-full max-w-[400px] overflow-hidden rounded-3xl border border-black/10 bg-white shadow-2xl shadow-[#0b1428]/20 animate-[popIn_.22s_cubic-bezier(.2,.9,.3,1.2)]">
        {/* subtle geometric header wash */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-[#1f4fb4]/10 to-transparent" />

        <div className="relative px-6 pb-3 pt-6">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="font-heading text-lg font-bold tracking-tight text-[#0b1428]">
                Connect a wallet
              </h2>
              <p className="mt-1 text-xs text-gray-500">
                Connect a Stellar wallet to launch the OSMO folio.
              </p>
            </div>
            <button
              onClick={closeModal}
              aria-label="Close"
              className="-mr-1 -mt-1 flex h-8 w-8 items-center justify-center rounded-full text-gray-400 transition hover:bg-black/5 hover:text-black"
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
              </svg>
            </button>
          </div>
        </div>

        {/* wallet list */}
        <div className="relative flex flex-col gap-1.5 px-4 pb-2">
          {WALLETS.map((w) => {
            const isFreighter = w.id === "freighter";
            const isBusy = connecting && selected === w.id;
            const badge = w.soon
              ? "Soon"
              : isFreighter && available !== null
                ? available
                  ? "Detected"
                  : "Install"
                : null;
            return (
              <button
                key={w.id}
                onClick={() => onPick(w)}
                disabled={w.soon || connecting}
                className={[
                  "group flex items-center gap-3 rounded-2xl border p-3 text-left transition",
                  w.soon
                    ? "cursor-not-allowed border-transparent opacity-45"
                    : "border-transparent hover:border-black/10 hover:bg-black/[0.03] active:scale-[0.99]",
                  isBusy ? "border-[#1f4fb4]/30 bg-[#1f4fb4]/5" : "",
                ].join(" ")}
              >
                <span
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"
                  style={{ backgroundColor: `${w.color}22`, color: w.color }}
                >
                  {w.glyph}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-[#0b1428]">{w.name}</span>
                  <span className="block text-xs text-gray-500">
                    {isBusy ? "Waiting for approval…" : w.tagline}
                  </span>
                </span>
                {isBusy ? (
                  <Spinner />
                ) : badge ? (
                  <span
                    className={[
                      "rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                      badge === "Detected"
                        ? "bg-emerald-500/15 text-emerald-600"
                        : badge === "Install"
                          ? "bg-[#f4a03c]/15 text-[#c9791f]"
                          : "bg-black/5 text-gray-400",
                    ].join(" ")}
                  >
                    {badge}
                  </span>
                ) : (
                  <svg viewBox="0 0 24 24" className="h-4 w-4 text-gray-300 transition group-hover:translate-x-0.5 group-hover:text-gray-500" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M9 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </button>
            );
          })}
        </div>

        {/* error / install prompt */}
        {(error || notInstalled) && (
          <div className="mx-4 mb-2 rounded-2xl bg-[#f4a03c]/10 px-4 py-3 text-xs text-[#a35a12]">
            {notInstalled ? (
              <>
                Freighter isn’t installed.{" "}
                <a href={INSTALL_URL} target="_blank" rel="noopener noreferrer" className="font-semibold underline">
                  Get it here
                </a>{" "}
                then reopen this dialog.
              </>
            ) : (
              error
            )}
          </div>
        )}

        {/* footer */}
        <div className="relative border-t border-black/5 px-6 py-4">
          <p className="text-center text-[11px] leading-relaxed text-gray-400">
            Stellar <span className="font-medium text-gray-500">Testnet</span> · non-custodial. By connecting you
            agree this is unaudited test software.
          </p>
        </div>
      </div>

      <style jsx global>{`
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes popIn { from { opacity: 0; transform: translateY(12px) scale(.97); } to { opacity: 1; transform: none; } }
      `}</style>
    </div>
  );
}

function Spinner() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5 animate-spin text-[#1f4fb4]" fill="none">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="3" opacity="0.2" />
      <path d="M21 12a9 9 0 00-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}
