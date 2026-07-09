// Layout for every /app route. The providers live here (not in the pages) so
// wallet connection and folio data persist across tab navigation.

import { AppShell } from "@/components/app/app-shell";
import { FolioProvider } from "@/components/app/folio-provider";
import { WalletProvider } from "@/components/app/wallet-provider";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <WalletProvider>
      <FolioProvider>
        <AppShell>{children}</AppShell>
      </FolioProvider>
    </WalletProvider>
  );
}
