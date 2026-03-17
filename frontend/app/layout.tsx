import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import { GameProvider } from '@/lib/game-context'
import { SolanaWalletProvider } from '@/components/wallet-provider'
import { BottomNav } from '@/components/bottom-nav'
import { TopNav } from '@/components/top-nav'
import './globals.css'

const inter = Inter({ 
  subsets: ["latin"],
  variable: '--font-inter'
});

export const metadata: Metadata = {
  title: 'Ref AI',
  description: 'AI-powered table tennis referee',
}

export const viewport: Viewport = {
  themeColor: '#ffffff',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body className={`${inter.variable} font-sans antialiased`}>
        <SolanaWalletProvider>
          <GameProvider>
            <TopNav />
            <main className="min-h-screen pb-24">
              {children}
            </main>
            <BottomNav />
          </GameProvider>
        </SolanaWalletProvider>
        <Analytics />
      </body>
    </html>
  )
}
