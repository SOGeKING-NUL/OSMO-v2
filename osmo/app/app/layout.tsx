// Layout for every /app route. The providers live here (not in the pages) so
// wallet connection and folio data persist across tab navigation.

import { AppShell } from "@/components/app/app-shell";
import { FolioProvider } from "@/components/app/folio-provider";

// WalletProvider now lives in the root layout so the connect flow is available
// site-wide; here we only need folio data + the app chrome.
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <FolioProvider>
      <AppShell>{children}</AppShell>
    </FolioProvider>
  );
}
