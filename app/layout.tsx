import type { Metadata, Viewport } from 'next'
import localFont from 'next/font/local'
import './globals.css'
import { Analytics } from '@vercel/analytics/react'
import { Providers } from './providers'
import { PillBase } from '@/components/ui/3d-adaptive-navigation-bar'

const geistSans = localFont({
  src: './fonts/GeistVF.woff',
  variable: '--font-geist-sans',
  weight: '100 900',
})
const geistMono = localFont({
  src: './fonts/GeistMonoVF.woff',
  variable: '--font-geist-mono',
  weight: '100 900',
})

export const metadata: Metadata = {
  title: 'Comparative Rideshares - Compare Uber, Lyft & Taxi',
  description: 'Compare prices and wait times across rideshare services in the Bay Area',
  manifest: '/manifest.json',
  appleWebApp: {
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
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
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
