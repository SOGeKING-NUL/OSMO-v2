"use client";

// Wraps route content so every navigation eases in instead of snapping into
// place. Lives inside Next `template.tsx` files, which re-mount on each
// navigation, so the animation replays every time you move between pages.
//
// Two variants:
//  - default: opacity fade only. Safe to place above `position: fixed` elements
//    (the landing / dtf floating navbars) because it never sets a `transform`,
//    which would otherwise re-anchor fixed children to this wrapper.
//  - slide:   opacity + a small upward rise, for route groups with no fixed
//    descendants (the /app shell) where a little travel reads as continuous.

import { motion, useReducedMotion } from "motion/react";
import type { ReactNode } from "react";

const EASE = [0.22, 1, 0.36, 1] as const;

export function PageTransition({
  children,
  slide = false,
}: {
  children: ReactNode;
  slide?: boolean;
}) {
  const reduce = useReducedMotion();
  if (reduce) return <>{children}</>;

  if (slide) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: EASE }}
      >
        {children}
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5, ease: EASE }}
    >
      {children}
    </motion.div>
  );
}
