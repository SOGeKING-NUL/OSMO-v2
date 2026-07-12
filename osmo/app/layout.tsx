import type { Metadata } from 'next'
import { Analytics } from '@vercel/analytics/next'
import './globals.css'
import { SmoothScroll } from '@/components/smooth-scroll';
import { WalletProvider } from '@/components/app/wallet-provider';
import { ConnectWalletModal } from '@/components/app/connect-wallet-modal';
import { Inter, Space_Grotesk, Geist,  Geist_Mono} from "next/font/google";
import { cn } from '@/lib/utils';

const inter = Inter({subsets:['latin'],variable:'--font-sans'});

const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  variable: '--font-space-grotesk',
});

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: 'OSMO — Stellar Ecosystem Folio',
  description:
    'One deposit, the whole Stellar basket. A diversified token folio (DTF) on Stellar testnet — five ecosystem assets, one token: SEF.',
    openGraph: {
    title: "OSMO — Stellar Ecosystem Folio",
    description: "One deposit, the whole Stellar basket. A diversified token folio (DTF) on Stellar testnet — five ecosystem assets, one token: SEF.",
    url: "https://osmo-one.vercel.app/", 
    siteName: "OSMO — Stellar Ecosystem Folio",
    images: [
      {
        url: "/landingpage.png", 
        width: 1200,
        height: 630,
        alt: "OSMO — Stellar Ecosystem Folio",
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "OSMO — Stellar Ecosystem Folio",
    description: "One deposit, the whole Stellar basket. A diversified token folio (DTF) on Stellar testnet — five ecosystem assets, one token: SEF.",
    images: ["/landingpage.png"], 
    site: "@osmodtf", 
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className={cn("font-sans", inter.variable, spaceGrotesk.variable)}>
      <body className={`${geistSans.variable} ${geistMono.variable} font-sans antialiased`}>
        <WalletProvider>
          <SmoothScroll>
            {children}
          </SmoothScroll>
          <ConnectWalletModal />
        </WalletProvider>
        <Analytics />
      </body>
    </html>
  )
}
