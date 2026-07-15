"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useWallet } from "@/components/app/wallet-provider";

const TABS = [
  { href: "/app", label: "Folio" },
  { href: "/app/deposit", label: "Deposit" },
  { href: "/app/faucet", label: "Faucet" },
  { href: "/app/pools", label: "Pools" },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { address, isConnected, openModal, disconnect } = useWallet();

  return (
    <div className="min-h-screen bg-[#f8f8f8]">
      <div className="relative mx-auto max-w-6xl px-6 py-8">
        <header className="flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            <div className="flex space-x-1.5">
              <div className="h-2 w-2 rounded-full bg-black" />
              <div className="h-2 w-2 rounded-full bg-[#1f4fb4]" />
            </div>
            <span className="font-heading text-lg font-semibold tracking-tight">
              OSMO <span className="text-[#d95b21]">DTF</span>
            </span>
          </Link>
          <div className="flex items-center gap-4">
            <Link
              href="/doc"
              className="text-xs font-medium tracking-widest text-gray-500 transition-colors hover:text-black"
            >
              DOCS
            </Link>
            {isConnected ? (
              <button
                onClick={disconnect}
                title="Disconnect"
                className="group flex items-center gap-2 rounded-full border bg-background px-3 py-1.5 text-xs transition hover:border-black/20"
              >
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                <code>
                  {address.slice(0, 4)}…{address.slice(-4)}
                </code>
                <span className="text-gray-400 group-hover:text-black">Disconnect</span>
              </button>
            ) : (
              <Button
                variant="outline"
                className="cursor-pointer rounded-full border-2 px-6"
                onClick={() => openModal()}
              >
                Connect wallet
              </Button>
            )}
          </div>
        </header>

        {/* Wallet gate: no app content is reachable until a wallet is connected. */}
        {isConnected ? (
          <>
            <nav className="mx-auto mt-8 flex max-w-2xl gap-1 rounded-full border border-black/10 bg-white p-1 text-sm shadow-sm">
              {TABS.map((t) => {
                const active = pathname === t.href;
                return (
                  <Link
                    key={t.href}
                    href={t.href}
                    className={cn(
                      "flex-1 rounded-full px-4 py-2 text-center font-medium transition-colors",
                      active
                        ? "bg-[#1f4fb4] text-white shadow-sm"
                        : "text-gray-600 hover:bg-black/5 hover:text-black",
                    )}
                  >
                    {t.label}
                  </Link>
                );
              })}
            </nav>

            <main className="mt-8 space-y-6">{children}</main>
          </>
        ) : (
          <ConnectGate onConnect={() => openModal("/app")} />
        )}

        <footer className="py-6 text-center text-xs text-muted-foreground">
          Testnet · deposit-XLM single-asset mint via Soroswap · redemption is
          never pausable
        </footer>
      </div>
    </div>
  );
}

function ConnectGate({ onConnect }: { onConnect: () => void }) {
  return (
    <div className="mt-16 flex flex-col items-center justify-center text-center">
      <div className="relative flex h-20 w-20 items-center justify-center rounded-3xl bg-[#1f4fb4]/10">
        <span className="absolute inset-0 animate-ping rounded-3xl bg-[#1f4fb4]/10" />
        <svg viewBox="0 0 24 24" className="relative h-9 w-9 text-[#1f4fb4]" fill="none" stroke="currentColor" strokeWidth="1.6">
          <rect x="3" y="6" width="18" height="13" rx="3" />
          <path d="M16 12h2" strokeLinecap="round" />
          <path d="M3 9h13a2 2 0 012 2" />
        </svg>
      </div>
      <h1 className="font-heading mt-6 text-2xl font-bold tracking-tight text-[#0b1428]">
        Connect your wallet to continue
      </h1>
      <p className="mt-2 max-w-sm text-sm text-gray-500">
        The OSMO folio needs a connected Stellar wallet to read your position and
        sign mints, deposits and redemptions.
      </p>
      <Button
        className="mt-7 cursor-pointer rounded-full bg-[#1f4fb4] px-8 text-white hover:bg-[#1a44a0]"
        onClick={onConnect}
      >
        Connect wallet
      </Button>
    </div>
  );
}
