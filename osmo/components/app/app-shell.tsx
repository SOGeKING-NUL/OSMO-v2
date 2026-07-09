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
  const { address, connect } = useWallet();

  return (
    <div className="min-h-screen bg-[#f8f8f8]">
      <div className="relative mx-auto max-w-4xl px-6 py-8">
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
          {address ? (
            <code className="rounded-full border bg-background px-3 py-1.5 text-xs">
              {address.slice(0, 4)}…{address.slice(-4)}
            </code>
          ) : (
            <Button
              variant="outline"
              className="cursor-pointer rounded-full border-2 px-6"
              onClick={() => connect().catch(() => {})}
            >
              Connect Freighter
            </Button>
          )}
        </header>

        <nav className="mt-8 flex gap-1 rounded-full border border-black/10 bg-white p-1 text-sm shadow-sm">
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

        <main className="mt-6 space-y-6">{children}</main>

        <footer className="py-6 text-center text-xs text-muted-foreground">
          Testnet · deposit-XLM single-asset mint via Soroswap · redemption is
          never pausable
        </footer>
      </div>
    </div>
  );
}
