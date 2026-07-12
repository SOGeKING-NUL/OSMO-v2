// "Why OSMO" — four protocol-guarantee cards with inline icons.

import { Reveal } from "@/components/landing/reveal";
import { SectionLabel } from "@/components/landing/section-label";

const FEATURES = [
  {
    title: "SINGLE-ASSET MINT",
    body: "One XLM in, five assets out. Swaps route through Aquarius pools atomically inside the mint transaction.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className="h-6 w-6">
        <path d="M4 7h13M13 3l4 4-4 4" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M20 17H7M11 21l-4-4 4-4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    title: "ORACLE-GUARDED NAV",
    body: "Prices come from Reflector feeds through an oracle router with staleness and divergence breakers built in.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className="h-6 w-6">
        <path d="M12 3l7 3v5c0 4.5-3 8.5-7 10-4-1.5-7-5.5-7-10V6l7-3z" strokeLinejoin="round" />
        <path d="M9 12l2 2 4-4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    title: "EXIT IS GUARANTEED",
    body: "Redemption can never be paused. Getting your assets back is a contract guarantee, not a promise.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className="h-6 w-6">
        <rect x="5" y="11" width="14" height="9" rx="2" />
        <path d="M8 11V8a4 4 0 017.8-1.3" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    title: "FULLY ON-CHAIN",
    body: "NAV, balances, supply and pool reserves are read straight from Soroban contracts. No indexer, no backend.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className="h-6 w-6">
        <path d="M12 3l8 4.5v9L12 21l-8-4.5v-9L12 3z" strokeLinejoin="round" />
        <path d="M12 12l8-4.5M12 12v9M12 12L4 7.5" strokeLinecap="round" />
      </svg>
    ),
  },
];

export function Features() {
  return (
    <section id="why" className="mt-28 scroll-mt-28">
      <Reveal>
        <SectionLabel>WHY OSMO</SectionLabel>
      </Reveal>
      <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {FEATURES.map((f, i) => (
          <Reveal key={f.title} delay={i * 90}>
            <div className="h-full rounded-2xl border border-black/10 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:border-[#1f4fb4]/40 hover:shadow-lg">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#1f4fb4]/10 text-[#1f4fb4]">
                {f.icon}
              </div>
              <h3 className="font-heading mt-5 text-sm font-bold tracking-widest">{f.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-gray-600">{f.body}</p>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
