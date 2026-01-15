import type { Metadata, Viewport } from 'next'
import { Bebas_Neue, IBM_Plex_Sans, JetBrains_Mono } from 'next/font/google'
import './globals.css'
import { Analytics } from '@vercel/analytics/react'
import { Providers } from './providers'
import { PillBase } from '@/components/ui/3d-adaptive-navigation-bar'

const bebasNeue = Bebas_Neue({
  weight: '400',
  subsets: ['latin'],
  variable: '--font-bebas',
  display: 'swap',
})

const ibmPlexSans = IBM_Plex_Sans({
  weight: ['300', '400', '500', '600', '700'],
  subsets: ['latin'],
  variable: '--font-ibm',
  display: 'swap',
})

const jetbrainsMono = JetBrains_Mono({
  weight: ['400', '700'],
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Comparative Rideshares - Compare Uber, Lyft & Taxi',
  description: 'Compare prices and wait times across rideshare services in the Bay Area',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'RideCompare',
  },
  icons: {
    apple: '/icons/icon-180.svg',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#1e40ff',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body
        className={`${bebasNeue.variable} ${ibmPlexSans.variable} ${jetbrainsMono.variable} antialiased font-sans`}
      >
        <Providers>
          {/* Fixed Navigation Bar */}
          <div className="fixed top-6 left-1/2 transform -translate-x-1/2 z-50">
            <PillBase />
          </div>
          {children}
          <Analytics />
        </Providers>
      </body>
    </html>
  )
}
