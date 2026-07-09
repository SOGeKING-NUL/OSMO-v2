'use client';

// Anchor that scrolls to a section WITHOUT writing the #hash into the URL.
// Uses the Lenis instance (exposed by components/smooth-scroll.tsx) when
// present so easing matches the rest of the page, otherwise falls back to
// native smooth scrolling. The href stays for accessibility, but default
// navigation is prevented so the address bar never changes.

import type Lenis from "lenis";

const NAV_OFFSET = -96; // clear the floating navbar

export function ScrollLink({
  to,
  className,
  children,
}: {
  to: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <a
      href={`#${to}`}
      className={className}
      onClick={(e) => {
        e.preventDefault();
        const el = document.getElementById(to);
        if (!el) return;
        const lenis = (window as unknown as { lenis?: Lenis }).lenis;
        if (lenis) lenis.scrollTo(el, { offset: NAV_OFFSET });
        else el.scrollIntoView({ behavior: "smooth" });
      }}
    >
      {children}
    </a>
  );
}
