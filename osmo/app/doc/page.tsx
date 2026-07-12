"use client";

// Public documentation for OSMO. A standalone, self-contained route: no live
// contract reads or env-dependent values, just an explainer anyone landing here
// can read to understand what the folio is and how to use the app.

import Link from "next/link";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { LaunchAppButton } from "@/components/launch-app-button";

// ---------------------------------------------------------------------------
// Table of contents — ids match the <Section> anchors below.
// ---------------------------------------------------------------------------
const TOC = [
  { id: "overview", label: "Overview" },
  { id: "dtf", label: "What is a DTF" },
  { id: "basket", label: "The SEF basket" },
  { id: "deposit", label: "Depositing" },
  { id: "redeem", label: "Redeeming" },
  { id: "app-guide", label: "Using the app" },
  { id: "getting-started", label: "Getting started" },
  { id: "architecture", label: "Under the hood" },
  { id: "faq", label: "FAQ" },
  { id: "glossary", label: "Glossary" },
];

// ----- scroll-aware top navbar (mirrors the /dtf page) ---------------------
function DocNavbar() {
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
            ? "mx-auto mt-3 w-[min(92%,60rem)] rounded-full border border-black/10 bg-white/85 px-6 py-3 shadow-lg shadow-black/5 backdrop-blur-xl"
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
          <Link
            href="/"
            className="hidden text-xs font-medium tracking-widest text-gray-500 transition-colors hover:text-black sm:block"
          >
            HOME
          </Link>
          <Link
            href="/dtf"
            className="hidden text-xs font-medium tracking-widest text-gray-500 transition-colors hover:text-black sm:block"
          >
            DTF
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

// ----- reusable section wrapper --------------------------------------------
function Section({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-28">
      <h2 className="font-heading text-2xl font-bold tracking-tight text-[#0b1428]">
        {title}
      </h2>
      <div className="mt-4 space-y-4 text-[15px] leading-relaxed text-gray-700">
        {children}
      </div>
    </section>
  );
}

// small labelled callout used for tips / notes
function Note({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-[#1f4fb4]/15 bg-[#1f4fb4]/5 px-5 py-4 text-sm text-gray-700">
      {children}
    </div>
  );
}

const BASKET = [
  { symbol: "XLM", role: "The Stellar native asset and the deposit hub every route passes through." },
  { symbol: "tstAQUA", role: "Testnet stand-in for AQUA, priced from live mainnet oracle data." },
  { symbol: "tstVELO", role: "Testnet stand-in for VELO, carried at a simulated reference price." },
  { symbol: "tstUSDC", role: "Testnet dollar stablecoin stand-in for balance and stability." },
  { symbol: "tstEURC", role: "Testnet euro stablecoin stand-in, adding currency diversity." },
];

const APP_PAGES = [
  {
    name: "Folio",
    href: "/app",
    desc: "Your dashboard. Live net asset value per share, total value, shares outstanding and the current weight of every underlying token.",
  },
  {
    name: "Deposit",
    href: "/app/deposit",
    desc: "Turn a single asset into a full basket position. Enter an amount, review the preview and mint SEF shares in one transaction. Burn shares here to redeem.",
  },
  {
    name: "Faucet",
    href: "/app/faucet",
    desc: "Testnet only. Claim free XLM and the four testnet basket tokens so you have something to deposit while you explore.",
  },
  {
    name: "Pools",
    href: "/app/pools",
    desc: "The liquidity behind the single-asset route. Reserve data for each XLM paired pool, read straight from the chain.",
  },
];

const FAQ = [
  {
    q: "Do I need to hold all five tokens to join the basket?",
    a: "No. That is the whole point. You deposit one asset and the folio sources the rest for you, so a single transaction gives you exposure to the entire basket.",
  },
  {
    q: "Is this real money?",
    a: "No. OSMO currently runs on Stellar testnet. Balances have no monetary value and the tokens are free from the faucet, so it is a safe place to learn how the folio behaves.",
  },
  {
    q: "Can my funds be locked?",
    a: "Redemption is never pausable. You can always burn your SEF shares to receive the underlying tokens back, regardless of any other state the contract is in.",
  },
  {
    q: "What is SEF?",
    a: "SEF is the share token of the folio. Holding SEF represents a proportional claim on everything the basket holds. Its value tracks the net asset value of the underlying tokens.",
  },
  {
    q: "How are prices decided?",
    a: "Prices come from an on-chain oracle network with a safety breaker. If a feed goes stale or drifts too far from the others, the folio refuses to serve a value rather than acting on a bad price.",
  },
];

const GLOSSARY = [
  { term: "DTF", def: "Diversified Token Folio. An on-chain basket of assets held at fixed target weights by a smart contract." },
  { term: "SEF", def: "The folio share token. One SEF is a proportional claim on the whole basket." },
  { term: "NAV", def: "Net asset value. The total worth of everything the folio holds, and per share when divided by SEF supply." },
  { term: "Target weight", def: "The share of the basket each token is meant to hold. The contract steers back toward these on every mint and redeem." },
  { term: "Mint", def: "Creating new SEF shares by adding assets to the folio." },
  { term: "Redeem", def: "Burning SEF shares to take the underlying tokens back out of the folio." },
];

export default function DocPage() {
  return (
    <div className="min-h-screen bg-[#f8f8f8]">
      <DocNavbar />
      <div className="h-24" aria-hidden="true" />

      <div className="mx-auto max-w-6xl px-6 pb-24 pt-8">
        {/* Hero */}
        <header className="max-w-3xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-white px-4 py-1.5 text-xs font-medium tracking-widest text-gray-500 shadow-sm">
            <span className="inline-block h-2 w-2 rounded-full bg-[#d95b21]" aria-hidden="true" />
            DOCUMENTATION
          </div>
          <h1 className="font-heading mt-5 text-4xl font-bold leading-[1.05] tracking-tight text-[#0b1428] sm:text-5xl">
            Everything you need to
            <br />
            understand OSMO.
          </h1>
          <p className="mt-5 text-base text-gray-600">
            OSMO is a Diversified Token Folio on Stellar. Make one deposit and
            hold a whole basket of ecosystem assets through a single share token.
            This guide walks through the idea, the basket, and every screen in
            the app.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <LaunchAppButton
              plain
              href="/app"
              className="cursor-pointer rounded-full bg-[#1f4fb4] px-6 py-2.5 text-sm font-semibold text-white shadow hover:bg-[#1a44a0]"
            >
              Launch the app
            </LaunchAppButton>
            <Link
              href="/dtf"
              className="cursor-pointer rounded-full border border-black/10 bg-white px-6 py-2.5 text-sm font-semibold shadow-sm transition hover:bg-black/5"
            >
              Read the explainer
            </Link>
          </div>
        </header>

        {/* Body: sticky TOC + content */}
        <div className="mt-16 gap-12 lg:flex">
          {/* sidebar */}
          <aside className="mb-10 lg:mb-0 lg:w-56 lg:shrink-0">
            <nav className="lg:sticky lg:top-28">
              <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">
                On this page
              </p>
              <ul className="mt-4 space-y-1 border-l border-black/10">
                {TOC.map((item) => (
                  <li key={item.id}>
                    <a
                      href={`#${item.id}`}
                      className="-ml-px block border-l-2 border-transparent py-1.5 pl-4 text-sm text-gray-500 transition-colors hover:border-[#1f4fb4] hover:text-black"
                    >
                      {item.label}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
          </aside>

          {/* content */}
          <main className="min-w-0 flex-1 space-y-16">
            <Section id="overview" title="Overview">
              <p>
                Managing a diversified crypto position usually means buying and
                tracking many tokens by hand. OSMO removes that work. It packages
                a curated set of Stellar ecosystem assets into one folio and hands
                you a single token that represents your slice of it.
              </p>
              <p>
                Behind that token is a Soroban smart contract that holds the real
                assets, keeps them at fixed target weights, and lets anyone mint
                or redeem at the folio&apos;s live value. You get diversification with
                the simplicity of holding one thing.
              </p>
              <Note>
                OSMO runs on Stellar testnet today. Everything you do here is
                free and carries no monetary value, so it is a safe way to try
                the full flow end to end.
              </Note>
            </Section>

            <Section id="dtf" title="What is a DTF">
              <p>
                A Diversified Token Folio, or DTF, is an on-chain basket of assets
                held in fixed target weights by a smart contract. Rather than an
                off-chain fund you have to trust, the basket and its rules live
                entirely on the chain where anyone can verify them.
              </p>
              <p>
                Deposit a single asset and the contract gives you a proportional
                claim on the entire basket in return. That claim is the SEF share
                token. As the value of the underlying assets moves, so does the
                value of your shares, with no manual rebalancing on your part.
              </p>
            </Section>

            <Section id="basket" title="The SEF basket">
              <p>
                The folio holds five Stellar ecosystem tokens at fixed target
                weights. On every mint and redeem the contract steers the holdings
                back toward those weights, so the mix stays balanced over time.
              </p>
              <div className="space-y-3">
                {BASKET.map((b) => (
                  <div
                    key={b.symbol}
                    className="flex flex-col gap-1 rounded-xl border bg-white px-5 py-4 shadow-sm sm:flex-row sm:items-center sm:gap-4"
                  >
                    <span className="w-24 shrink-0 font-semibold text-[#0b1428]">
                      {b.symbol}
                    </span>
                    <span className="text-sm text-gray-600">{b.role}</span>
                  </div>
                ))}
              </div>
              <p>
                The testnet tokens are stand-ins for real ecosystem assets. Most
                of them carry live prices relayed from mainnet oracle data so the
                folio behaves realistically while you experiment.
              </p>
            </Section>

            <Section id="deposit" title="Depositing">
              <p>
                Depositing is how you enter the folio. You supply one asset, the
                contract routes it into every basket token through Stellar
                liquidity pools, and it mints SEF shares to your wallet in the
                same transaction.
              </p>
              <p>
                Because the routing is automatic, you never have to source the
                individual tokens yourself. One deposit in, a full balanced
                position out. The Deposit screen shows a preview of the shares you
                will receive before you confirm.
              </p>
            </Section>

            <Section id="redeem" title="Redeeming">
              <p>
                Redeeming is the reverse. Burn your SEF shares and the folio
                returns the underlying basket tokens to your wallet, proportional
                to the amount you redeem.
              </p>
              <Note>
                Redemption is never pausable. Whatever else is happening, you can
                always exit the folio and recover the assets your shares
                represent. This is a core guarantee of the design.
              </Note>
            </Section>

            <Section id="app-guide" title="Using the app">
              <p>
                The app is organised into four screens. A wallet connection is
                required before any of them will load your position, since the
                folio needs to read your balances and sign transactions.
              </p>
              <div className="space-y-3">
                {APP_PAGES.map((p) => (
                  <div key={p.name} className="rounded-xl border bg-white p-5 shadow-sm">
                    <div className="flex items-center justify-between gap-4">
                      <h3 className="font-heading font-semibold text-[#0b1428]">
                        {p.name}
                      </h3>
                      <LaunchAppButton
                        plain
                        href={p.href}
                        className="cursor-pointer text-xs font-medium tracking-widest text-[#1f4fb4] hover:underline"
                      >
                        OPEN →
                      </LaunchAppButton>
                    </div>
                    <p className="mt-2 text-sm text-gray-600">{p.desc}</p>
                  </div>
                ))}
              </div>
            </Section>

            <Section id="getting-started" title="Getting started">
              <p>Going from nothing to a folio position takes four steps.</p>
              <ol className="space-y-4">
                {[
                  ["Connect a wallet", "Open the app and connect a Stellar wallet. The folio uses it to read your balances and sign transactions."],
                  ["Claim test tokens", "Visit the Faucet and claim free testnet assets so you have something to deposit."],
                  ["Make a deposit", "On the Deposit screen, choose an amount, review the preview, and mint your first SEF shares."],
                  ["Watch your folio", "Head to the Folio screen to see your position, the live net asset value and the current basket weights."],
                ].map(([title, body], i) => (
                  <li key={title} className="flex gap-4">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#1f4fb4] text-sm font-bold text-white">
                      {i + 1}
                    </span>
                    <div>
                      <h3 className="font-semibold text-[#0b1428]">{title}</h3>
                      <p className="mt-1 text-sm text-gray-600">{body}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </Section>

            <Section id="architecture" title="Under the hood">
              <p>
                The folio is a smart contract on Soroban, the smart contract
                platform of the Stellar network. It custodies the basket tokens,
                enforces the target weights, and exposes minting, redeeming and
                value reads that anyone can call.
              </p>
              <p>
                Prices are drawn from an on-chain oracle network and guarded by a
                safety breaker. If a price feed becomes stale or drifts too far
                from the others, a value read stops rather than returning a
                misleading number. That protects both minting and redeeming from
                acting on bad data.
              </p>
              <p>
                The single-asset deposit route relies on Stellar liquidity pools
                that pair each basket token with the native asset. The app reads
                those pool reserves directly from the chain, which is what the
                Pools screen surfaces.
              </p>
            </Section>

            <Section id="faq" title="FAQ">
              <div className="space-y-3">
                {FAQ.map((f) => (
                  <details
                    key={f.q}
                    className="group rounded-xl border bg-white px-5 py-4 shadow-sm"
                  >
                    <summary className="flex cursor-pointer list-none items-center justify-between font-medium text-[#0b1428]">
                      {f.q}
                      <span className="ml-4 text-gray-400 transition-transform group-open:rotate-45">
                        +
                      </span>
                    </summary>
                    <p className="mt-3 text-sm text-gray-600">{f.a}</p>
                  </details>
                ))}
              </div>
            </Section>

            <Section id="glossary" title="Glossary">
              <dl className="divide-y divide-black/5 overflow-hidden rounded-xl border bg-white shadow-sm">
                {GLOSSARY.map((g) => (
                  <div key={g.term} className="flex flex-col gap-1 px-5 py-4 sm:flex-row sm:gap-6">
                    <dt className="w-32 shrink-0 font-semibold text-[#0b1428]">
                      {g.term}
                    </dt>
                    <dd className="text-sm text-gray-600">{g.def}</dd>
                  </div>
                ))}
              </dl>
            </Section>

            {/* closing CTA */}
            <section className="rounded-2xl border bg-white px-8 py-10 text-center shadow-sm">
              <h2 className="font-heading text-2xl font-bold text-[#0b1428]">
                Ready to try it?
              </h2>
              <p className="mx-auto mt-2 max-w-sm text-sm text-gray-600">
                Grab test tokens from the faucet and mint your first SEF shares.
                It only takes a minute.
              </p>
              <div className="mt-6 flex flex-wrap justify-center gap-3">
                <LaunchAppButton
                  plain
                  href="/app/faucet"
                  className="cursor-pointer rounded-full border border-black/10 bg-white px-6 py-2.5 text-sm font-semibold shadow-sm hover:bg-black/5"
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
        </div>
      </div>

      <footer className="border-t py-8 text-center text-xs text-muted-foreground">
        Testnet · OSMO DTF · Stellar Ecosystem Folio ·{" "}
        <Link href="/" className="underline">
          Home
        </Link>{" "}
        ·{" "}
        <Link href="/dtf" className="underline">
          DTF explainer
        </Link>{" "}
        ·{" "}
        <Link href="/app" className="underline">
          Launch app
        </Link>
      </footer>
    </div>
  );
}
