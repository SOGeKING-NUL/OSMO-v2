"use client";

// Gate for every "launch the app" entry point. If a wallet is connected it
// navigates straight to `href`; otherwise it opens the connect-wallet modal and
// remembers `href` so navigation continues automatically once connected.
// Use `plain` for text/link-style triggers, otherwise it renders the shadcn Button.

import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useWallet } from "@/components/app/wallet-provider";

type Props = {
  href?: string;
  className?: string;
  children: ReactNode;
  plain?: boolean;
  variant?: React.ComponentProps<typeof Button>["variant"];
};

export function LaunchAppButton({ href = "/app", className, children, plain, variant }: Props) {
  const { isConnected, openModal } = useWallet();
  const router = useRouter();

  const go = () => (isConnected ? router.push(href) : openModal(href));

  if (plain) {
    return (
      <button type="button" onClick={go} className={className}>
        {children}
      </button>
    );
  }
  return (
    <Button type="button" variant={variant} onClick={go} className={className}>
      {children}
    </Button>
  );
}
