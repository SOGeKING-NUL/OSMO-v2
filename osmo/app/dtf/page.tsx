"use client";

// Standalone explainer page for the DTF (Diversified Token Folio) concept.
// Uses the landing navbar for branding consistency but is its own route,
// separate from the /app shell.

import Link from "next/link";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { LaunchAppButton } from "@/components/launch-app-button";
import { POOLS, TOKEN_INFO } from "@/lib/config";
import { useLiveFolio } from "@/hooks/use-live-folio";
import { fmtUnits } from "@/lib/folio";

const PRICE_DECIMALS = 14;
const SHARE_DECIMALS = 7;

// ----- minimal inline navbar (mirrors landing/navbar.tsx) -----
function DtfNavbar() {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 32);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div className="fixed inset-x-0 top-0 z-50">
      <nav
        className={cn(
          "flex items-center justify-between transition-all duration-500 ease-out",
          scrolled
            ? "mx-auto mt-3 w-[min(92%,56rem)] rounded-full border border-black/10 bg-white/85 px-6 py-3 shadow-lg shadow-black/5 backdrop-blur-xl"
            : "mx-auto mt-0 w-full rounded-none border-b border-black/5 bg-[#f8f8f8]/80 px-6 py-6 backdrop-blur-xl",
        )}
      >
        <Link href="/" className="flex shrink-0 items-center gap-3">
          <div className="flex space-x-2">
            <div className="h-2 w-2 rounded-full bg-black" />
            <div className="h-2 w-2 rounded-full bg-[#d95b21]" />
          </div>
          <span className="font-heading text-sm font-bold tracking-[0.2em]">
            OSMO
          </span>
        </Link>

        <div className="flex items-center gap-6">
          <span className="hidden items-center gap-1.5 text-xs tracking-widest text-gray-500 sm:flex">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-60" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
            </span>
            TESTNET
          </span>
          <Link
            href="/"
            className="text-xs font-medium tracking-widest text-gray-500 transition-colors hover:text-black"
          >
            HOME
          </Link>
          <Link
            href="/doc"
            className="text-xs font-medium tracking-widest text-gray-500 transition-colors hover:text-black"
          >
            DOCS
          </Link>
          <LaunchAppButton
            plain
            className={cn(
              "cursor-pointer text-sm font-medium transition-all",
              scrolled
                ? "rounded-full bg-black px-5 py-2 text-white hover:bg-black/85"
                : "hover:underline",
            )}
          >
            LAUNCH APP
          </LaunchAppButton>
        </div>
      </nav>
    </div>
  );
}

// ----- ingredient card -----
interface IngredientCardProps {
  token: string;
  weightBps?: number;
  price?: string;
}

function IngredientCard({ token, weightBps, price }: IngredientCardProps) {
  const info = TOKEN_INFO[token];
  if (!info) return null;
  return (
    <div className="flex items-center justify-between rounded-xl border bg-white px-5 py-4 shadow-sm">
      <div className="flex items-center gap-3">
        <span
          className="inline-block h-3 w-3 rounded-full"
          style={{ background: info.color }}
        />
        <span className="font-semibold">{info.symbol}</span>
        {info.simulated && (
          <span className="rounded bg-[#f0883e]/10 px-1.5 py-0.5 text-[10px] font-medium text-[#f0883e]">
            simulated price
          </span>
        )}
      </div>
      <div className="text-right text-sm tabular-nums text-muted-foreground">
        {weightBps !== undefined && (
          <div className="text-base font-semibold text-foreground">
            {(weightBps / 100).toFixed(1)}%
          </div>
        )}
        {price && <div>{price}</div>}
      </div>
    </div>
  );
}

// ----- step card -----
function StepCard({
  n,
  title,
  body,
}: {
  n: number;
  title: string;
  body: string;
}) {
  return (
    <div className="flex gap-5">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#1f4fb4] text-sm font-bold text-white">
        {n}
      </div>
      <div>
        <h3 className="font-semibold">{title}</h3>
        <p className="mt-1 text-sm text-muted-foreground">{body}</p>
      </div>
    </div>
  );
}

// ----- main page -----
export default function DtfPage() {
  const { assets, prices, nav, supply } = useLiveFolio();

  return (
    <div className="min-h-screen bg-[#f8f8f8]">
      <DtfNavbar />
      <div className="h-24" aria-hidden="true" />

      <main className="mx-auto max-w-3xl space-y-16 px-6 pb-24 pt-8">
        {/* Hero */}
        <section className="space-y-4 text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-white px-4 py-1.5 text-xs font-medium tracking-widest text-gray-500 shadow-sm">
            <span
              className="inline-block h-2 w-2 rounded-full bg-[#d95b21]"
              aria-hidden="true"
            />
            DIVERSIFIED TOKEN FOLIO
          </div>
          <h1 className="text-4xl font-bold tracking-tight text-balance">
            One token.
            <br />
            The whole Stellar basket.
          </h1>
          <p className="mx-auto max-w-xl text-base text-muted-foreground">
            A <strong>Diversified Token Folio (DTF)</strong> is an on-chain,
            tokenized basket of assets held in fixed target weights by a Soroban
            smart contract. Deposit a single asset, receive a proportional claim
            on the entire basket — no manual portfolio management required.
          </p>
          <div className="flex justify-center gap-3 pt-2">
            <LaunchAppButton
              plain
              href="/app/deposit"
              className="cursor-pointer rounded-full bg-[#1f4fb4] px-6 py-2.5 text-sm font-semibold text-white shadow hover:bg-[#1a44a0]"
            >
              Start depositing
            </LaunchAppButton>
            <LaunchAppButton
              plain
              href="/app"
              className="cursor-pointer rounded-full border border-black/10 bg-white px-6 py-2.5 text-sm font-semibold shadow hover:bg-black/5"
            >
              View folio
            </LaunchAppButton>
          </div>
        </section>

        {/* Live stats */}
        {nav && (
          <section className="grid grid-cols-3 divide-x divide-black/10 overflow-hidden rounded-2xl border bg-white shadow-sm">
            {[
              {
                label: "NAV / share",
                value: `$${fmtUnits(nav.per_share, PRICE_DECIMALS, 6)}`,
              },
              {
                label: "Total value",
                value: `$${fmtUnits(nav.total_value, PRICE_DECIMALS, 2)}`,
              },
              {
                label: "Shares outstanding",
                value:
                  supply !== null ? fmtUnits(supply, SHARE_DECIMALS, 2) : "—",
              },
            ].map((s) => (
              <div key={s.label} className="px-6 py-5 text-center">
                <div className="text-xs uppercase tracking-widest text-muted-foreground">
                  {s.label}
                </div>
                <div className="mt-1 text-2xl font-semibold tabular-nums">
                  {s.value}
                </div>
              </div>
            ))}
          </section>
        )}

        {/* Basket composition */}
        <section className="space-y-5">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">
              Basket composition
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              The SEF folio holds five Stellar ecosystem tokens at fixed target
              weights. The contract rebalances on every mint and redeem to
              maintain these ratios.
            </p>
          </div>
          <div className="space-y-3">
            {assets.length > 0
              ? assets.map((a) => (
                  <IngredientCard
                    key={a.token}
                    token={a.token}
                    weightBps={a.weight_bps}
                    price={
                      prices[a.token]
                        ? `$${fmtUnits(prices[a.token]!.price, PRICE_DECIMALS, 6)}`
                        : undefined
                    }
                  />
                ))
              : ["XLM", "tstAQUA", "tstVELO", "tstUSDC", "tstEURC"].map(
                  (sym) => (
                    <div
                      key={sym}
                      className="h-16 animate-pulse rounded-xl bg-black/5"
                    />
                  ),
                )}
          </div>
        </section>

        {/* How it works */}
        <section className="space-y-6">
          <h2 className="text-2xl font-bold tracking-tight">How it works</h2>
          <div className="space-y-5">
            <StepCard
              n={1}
              title="Deposit a single asset"
              body="Send XLM (or any hub token) to the folio router. No need to source all five basket tokens yourself."
            />
            <StepCard
              n={2}
              title="Automatic Soroswap routing"
              body="The contract swaps your deposit through XLM-hub Soroswap pools into each basket token, weighted by target allocation."
            />
            <StepCard
              n={3}
              title="Receive SEF shares"
              body="Basket tokens are delivered to the folio contract, which mints proportional SEF shares to your wallet in the same transaction."
            />
            <StepCard
              n={4}
              title="Redeem any time"
              body="Burn SEF shares to receive all five underlying tokens back to your wallet — redemption is never pausable."
            />
          </div>
        </section>

        {/* Liquidity pools */}
        <section className="space-y-5">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">
              Underlying pools
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Four Soroswap XLM-hub pools power the single-asset deposit route.
              Reserve data is read live from each pair contract.{" "}
              <Link
                href="/app/pools"
                className="font-medium text-[#1f4fb4] underline underline-offset-2"
              >
                See full pool data →
              </Link>
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {POOLS.map((p) => (
              <span
                key={p.id}
                className="rounded-full border bg-white px-4 py-1.5 text-sm font-medium shadow-sm"
              >
                {p.pair}
              </span>
            ))}
          </div>
        </section>

        {/* Architecture */}
        <section className="space-y-4">
          <h2 className="text-2xl font-bold tracking-tight">Architecture</h2>
          <div className="space-y-3 text-sm text-muted-foreground">
            <p>
              The folio contract is written in Rust on{" "}
              <strong className="text-foreground">Soroban</strong>, Stellar's
              smart contract platform. It exposes a minimal interface:{" "}
              <code>mint</code>, <code>redeem</code>,{" "}
              <code>mint_single_asset</code>, <code>nav</code>, and{" "}
              <code>get_assets</code>.
            </p>
            <p>
              Prices are sourced from the{" "}
              <strong className="text-foreground">Reflector</strong> oracle
              network and gated by a staleness/divergence breaker — if any feed
              goes stale or deviates beyond tolerance, the NAV read reverts
              rather than serving a bad price.
            </p>
            <p>
              The frontend uses Next.js with the{" "}
              <strong className="text-foreground">Stellar SDK</strong> contract
              client factory (<code>contract.Client.from</code>) to call the
              contract without requiring a separate codegen step — the ABI is
              fetched on-demand from the chain.
            </p>
          </div>
        </section>

        {/* CTA */}
        <section className="rounded-2xl border bg-white px-8 py-10 text-center shadow-sm">
          <h2 className="text-2xl font-bold">Ready to try it?</h2>
          <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
            This is a testnet deployment. Use the faucet to get free test
            tokens, then deposit to mint your first SEF shares.
          </p>
          <div className="mt-6 flex justify-center gap-3">
            <LaunchAppButton
              plain
              href="/app/faucet"
              className="cursor-pointer rounded-full border border-black/10 bg-white px-6 py-2.5 text-sm font-semibold shadow hover:bg-black/5"
            >
              Get test tokens
            </LaunchAppButton>
            <LaunchAppButton
              plain
              href="/app/deposit"
              className="cursor-pointer rounded-full bg-[#1f4fb4] px-6 py-2.5 text-sm font-semibold text-white shadow hover:bg-[#1a44a0]"
            >
              Deposit now
            </LaunchAppButton>
          </div>
        </section>
      </main>

      <footer className="border-t py-8 text-center text-xs text-muted-foreground">
        Testnet · OSMO DTF · Stellar Ecosystem Folio ·{" "}
        <Link href="/" className="underline">
          Home
        </Link>{" "}
        ·{" "}
        <Link href="/app" className="underline">
          Launch app
        </Link>
      </footer>
    </div>
  );
}
