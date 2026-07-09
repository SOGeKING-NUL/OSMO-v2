import type { Metadata } from 'next'
import { Geist, Geist_Mono, Inter, Space_Grotesk } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import './globals.css'
import { cn } from "@/lib/utils";
import { SmoothScroll } from '@/components/smooth-scroll';

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
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className={cn("font-sans", inter.variable, spaceGrotesk.variable)}>
      <body className={`${geistSans.variable} ${geistMono.variable} font-sans antialiased`}>
         <SmoothScroll>
          {children}
         </SmoothScroll>
        <Analytics />
      </body>
    </html>
  )
}
