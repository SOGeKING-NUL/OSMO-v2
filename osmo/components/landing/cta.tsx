// Closing call-to-action panel with halftone print texture.

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Reveal } from "@/components/landing/reveal";

export function Cta() {
  return (
    <section className="mt-28">
      <Reveal>
        <div className="relative max-w-7xl ml-auto mr-auto overflow-hidden rounded-3xl border border-[#1f4fb4]/25 bg-linear-to-br from-[#1f4fb4]/10 via-[#f3e6c5]/60 to-transparent px-8 py-16 text-center sm:px-16">
          <div
            className="halftone-light mask-fade-radial pointer-events-none absolute inset-0 opacity-40"
            aria-hidden="true"
          />
          <h2 className="font-heading relative text-3xl font-bold tracking-tight sm:text-4xl">
            READY TO HOLD THE ECOSYSTEM?
          </h2>
          <p className="relative mx-auto mt-4 max-w-md text-sm leading-relaxed text-gray-600">
            Free testnet tokens from the built-in faucet. Connect Freighter and mint your first
            SEF in under a minute.
          </p>
          <div className="relative mt-9">
            <Button
              asChild
              className="rounded-full bg-black px-10 text-white shadow-lg transition-shadow hover:bg-black/85 hover:shadow-[0_0_28px_rgba(217,91,33,0.35)]"
            >
              <Link href="/app">MINT YOUR FIRST SEF →</Link>
            </Button>
          </div>
        </div>
      </Reveal>
    </section>
  );
}
