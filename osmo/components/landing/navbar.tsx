"use client";

// Landing navbar — CardNav pattern. A floating pill that expands on the
// animated hamburger toggle into a row of cards (GSAP height + stagger),
// keeping OSMO branding, palette and links.

import { useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { gsap } from "gsap";
import { ScrollLink } from "@/components/landing/scroll-link";
import { LaunchAppButton } from "@/components/launch-app-button";

type CardLink = {
  label: string;
  ariaLabel: string;
  to?: string; // in-page section (smooth scroll)
  href?: string; // route
};

type NavCard = {
  label: string;
  bgColor: string;
  textColor: string;
  links: CardLink[];
};

const ITEMS: NavCard[] = [
  {
    label: "Explore",
    bgColor: "#132347",
    textColor: "#ffffff",
    links: [
      { label: "The Basket", to: "basket", ariaLabel: "Jump to the basket" },
      { label: "How It Works", to: "how-it-works", ariaLabel: "Jump to how it works" },
      { label: "Why OSMO", to: "why", ariaLabel: "Jump to why OSMO" },
    ],
  },
  {
    label: "Product",
    bgColor: "#1f4fb4",
    textColor: "#ffffff",
    links: [
      { label: "Docs", href: "/doc", ariaLabel: "Read the docs" },
      { label: "DTF Explainer", href: "/dtf", ariaLabel: "Read the DTF explainer" },
      { label: "Launch App", href: "/app", ariaLabel: "Launch the app" },
    ],
  },
  {
    label: "Network",
    bgColor: "#5b6ef2",
    textColor: "#ffffff",
    links: [
      { label: "Deposit", href: "/app/deposit", ariaLabel: "Deposit" },
      { label: "Faucet", href: "/app/faucet", ariaLabel: "Testnet faucet" },
      { label: "Pools", href: "/app/pools", ariaLabel: "Liquidity pools" },
    ],
  },
];

const BASE_COLOR = "#ffffff";
const MENU_COLOR = "#132347";
const EASE = "power3.out";

export function Navbar() {
  const [isOpen, setIsOpen] = useState(false);
  const navRef = useRef<HTMLDivElement | null>(null);
  const cardsRef = useRef<HTMLDivElement[]>([]);
  const tlRef = useRef<gsap.core.Timeline | null>(null);

  const calculateHeight = () => {
    const navEl = navRef.current;
    if (!navEl) return 244;

    const isMobile = window.matchMedia("(max-width: 768px)").matches;
    if (isMobile) {
      const contentEl = navEl.querySelector(".card-nav-content") as HTMLElement | null;
      if (contentEl) {
        const prev = {
          visibility: contentEl.style.visibility,
          pointerEvents: contentEl.style.pointerEvents,
          position: contentEl.style.position,
          height: contentEl.style.height,
        };
        contentEl.style.visibility = "visible";
        contentEl.style.pointerEvents = "auto";
        contentEl.style.position = "static";
        contentEl.style.height = "auto";
        void contentEl.offsetHeight;
        const total = 60 + contentEl.scrollHeight + 16;
        contentEl.style.visibility = prev.visibility;
        contentEl.style.pointerEvents = prev.pointerEvents;
        contentEl.style.position = prev.position;
        contentEl.style.height = prev.height;
        return total;
      }
    }
    return 244;
  };

  const createTimeline = () => {
    const navEl = navRef.current;
    if (!navEl) return null;

    gsap.set(navEl, { height: 60, overflow: "hidden" });
    gsap.set(cardsRef.current, { y: 46, opacity: 0 });

    const tl = gsap.timeline({ paused: true });
    tl.to(navEl, { height: calculateHeight, duration: 0.4, ease: EASE });
    tl.to(
      cardsRef.current,
      { y: 0, opacity: 1, duration: 0.4, ease: EASE, stagger: 0.08 },
      "-=0.1",
    );
    return tl;
  };

  useLayoutEffect(() => {
    const tl = createTimeline();
    tlRef.current = tl;
    return () => {
      tl?.kill();
      tlRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useLayoutEffect(() => {
    const handleResize = () => {
      if (!tlRef.current) return;
      tlRef.current.kill();
      const next = createTimeline();
      if (next) {
        if (isOpen) next.progress(1);
        tlRef.current = next;
      }
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const toggleMenu = () => {
    const tl = tlRef.current;
    if (!tl) return;
    if (!isOpen) {
      setIsOpen(true);
      tl.play(0);
    } else {
      tl.eventCallback("onReverseComplete", () => setIsOpen(false));
      tl.reverse();
    }
  };

  const setCardRef = (i: number) => (el: HTMLDivElement | null) => {
    if (el) cardsRef.current[i] = el;
  };

  return (
    <div className="fixed left-1/2 top-3 z-50 w-[min(92%,52rem)] -translate-x-1/2">
      <nav
        ref={navRef}
        className="relative block h-[60px] overflow-hidden rounded-2xl border border-black/10 shadow-lg shadow-black/5 backdrop-blur-xl will-change-[height]"
        style={{ backgroundColor: BASE_COLOR }}
      >
        {/* top bar */}
        <div className="absolute inset-x-0 top-0 z-[2] flex h-[60px] items-center justify-between px-3">
          {/* animated hamburger */}
          <button
            type="button"
            onClick={toggleMenu}
            aria-label={isOpen ? "Close menu" : "Open menu"}
            aria-expanded={isOpen}
            className="group order-2 flex h-full cursor-pointer flex-col items-center justify-center gap-[6px] px-2 md:order-none"
            style={{ color: MENU_COLOR }}
          >
            <span
              className={`h-[2px] w-[26px] bg-current transition-[transform,opacity] duration-300 ease-out group-hover:opacity-70 ${
                isOpen ? "translate-y-[4px] rotate-45" : ""
              }`}
            />
            <span
              className={`h-[2px] w-[26px] bg-current transition-[transform,opacity] duration-300 ease-out group-hover:opacity-70 ${
                isOpen ? "-translate-y-[4px] -rotate-45" : ""
              }`}
            />
          </button>

          {/* logo */}
          <Link
            href="/"
            className="order-1 flex items-center gap-3 md:absolute md:left-1/2 md:top-1/2 md:order-none md:-translate-x-1/2 md:-translate-y-1/2"
          >
            <div className="flex space-x-2">
              <div className="h-2 w-2 rounded-full bg-black" />
              <div className="h-2 w-2 rounded-full bg-[#d95b21]" />
            </div>
            <span className="font-heading text-sm font-bold tracking-[0.2em]">OSMO</span>
          </Link>

          {/* CTA */}
          <div className="order-3 flex items-center gap-4 md:order-none">
            <span className="hidden items-center gap-1.5 text-xs tracking-widest text-gray-500 sm:flex">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-60" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
              </span>
              TESTNET
            </span>
            <LaunchAppButton
              plain
              className="hidden h-9 cursor-pointer items-center rounded-full bg-black px-5 text-sm font-medium text-white transition-colors hover:bg-black/85 md:inline-flex"
            >
              LAUNCH APP
            </LaunchAppButton>
          </div>
        </div>

        {/* expandable cards */}
        <div
          className={`card-nav-content absolute inset-x-0 bottom-0 top-[60px] z-[1] flex flex-col items-stretch gap-2 p-2 md:flex-row md:items-end ${
            isOpen ? "visible pointer-events-auto" : "invisible pointer-events-none"
          }`}
          aria-hidden={!isOpen}
        >
          {ITEMS.map((item, idx) => (
            <div
              key={item.label}
              ref={setCardRef(idx)}
              className="flex min-h-[68px] min-w-0 flex-[1_1_auto] select-none flex-col gap-2 rounded-xl p-4 md:h-full md:min-h-0 md:flex-[1_1_0%]"
              style={{ backgroundColor: item.bgColor, color: item.textColor }}
            >
              <div className="text-[18px] font-medium tracking-[-0.5px] md:text-[20px]">
                {item.label}
              </div>
              <div className="mt-auto flex flex-col gap-[2px]">
                {item.links.map((lnk) => {
                  const inner = (
                    <>
                      <ArrowUpRight className="h-4 w-4 shrink-0" aria-hidden="true" />
                      {lnk.label}
                    </>
                  );
                  const cls =
                    "inline-flex items-center gap-1.5 text-[15px] transition-opacity duration-300 hover:opacity-75";
                  if (lnk.to) {
                    return (
                      <ScrollLink key={lnk.label} to={lnk.to} className={cls}>
                        {inner}
                      </ScrollLink>
                    );
                  }
                  // /app routes are wallet-gated: open the connect modal first.
                  if (lnk.href?.startsWith("/app")) {
                    return (
                      <LaunchAppButton key={lnk.label} plain href={lnk.href} className={`${cls} cursor-pointer`}>
                        {inner}
                      </LaunchAppButton>
                    );
                  }
                  return (
                    <Link key={lnk.label} href={lnk.href ?? "#"} aria-label={lnk.ariaLabel} className={cls}>
                      {inner}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </nav>
    </div>
  );
}
