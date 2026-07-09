"use client";

// Landing navbar. Sits flush at the top of the page; once the user scrolls it
// detaches into a centered floating pill (rounded, blurred, shadowed) with a
// smooth animated transition between the two states.

import { useEffect, useState } from "react";
import Link from "next/link";
import { ScrollLink } from "@/components/landing/scroll-link";
import { cn } from "@/lib/utils";

const LINKS = [
  { to: "basket", label: "BASKET" },
  { to: "how-it-works", label: "HOW IT WORKS" },
  { to: "why", label: "WHY OSMO" },
];

const ROUTE_LINKS = [{ href: "/dtf", label: "DTF" }];

export function Navbar() {
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
            <div className="h-2 w-2 rounded-full bg-black"></div>
            <div className="h-2 w-2 rounded-full bg-[#d95b21]"></div>
          </div>
          <span className="font-heading text-sm font-bold tracking-[0.2em]">
            OSMO
          </span>
        </Link>

        <div className="hidden items-center gap-7 text-xs font-medium tracking-widest text-gray-500 md:flex">
          {LINKS.map((l) => (
            <ScrollLink
              key={l.to}
              to={l.to}
              className="transition-colors hover:text-black"
            >
              {l.label}
            </ScrollLink>
          ))}
          {ROUTE_LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="transition-colors hover:text-black"
            >
              {l.label}
            </Link>
          ))}
        </div>

        <div className="flex items-center space-x-6">
          <span className="hidden items-center gap-1.5 text-xs tracking-widest text-gray-500 sm:flex">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-60" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
            </span>
            TESTNET
          </span>
          <Link
            href="/app"
            className={cn(
              "text-sm font-medium transition-all",
              scrolled
                ? "rounded-full bg-black px-5 py-2 text-white hover:bg-black/85"
                : "hover:underline",
            )}
          >
            LAUNCH APP
          </Link>
          <button className="flex flex-col space-y-1" aria-label="Menu">
            <span className="h-0.5 w-6 bg-black"></span>
            <span className="h-0.5 w-6 bg-black"></span>
          </button>
        </div>
      </nav>
    </div>
  );
}
