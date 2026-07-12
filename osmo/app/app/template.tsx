// The /app shell has no fixed-position descendants, so tab navigation here can
// afford a small upward slide on top of the global fade for a more continuous
// feel when moving between Folio, Deposit, Faucet and Pools.

import { PageTransition } from "@/components/page-transition";

export default function AppTemplate({ children }: { children: React.ReactNode }) {
  return <PageTransition slide>{children}</PageTransition>;
}
