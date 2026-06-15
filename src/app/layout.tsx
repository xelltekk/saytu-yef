import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { ServiceWorkerRegister } from '@/components/pwa/ServiceWorkerRegister'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })

export const metadata: Metadata = {
  title: 'Saytu Yëf — Gestion de Stock & Ventes au Sénégal',
  description:
    'Application SaaS de gestion de stock et de ventes pour les entreprises sénégalaises. Wave, Orange Money intégrés. Entrée hors ligne depuis l\'étranger.',
  keywords: ['gestion stock', 'ventes', 'Sénégal', 'Wave', 'Orange Money', 'inventaire', 'POS'],
  authors: [{ name: 'Saytu Yëf' }],
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Saytu Yëf',
    startupImage: [
      { url: '/icons/icon-512x512.png' },
    ],
  },
  openGraph: {
    title: 'Saytu Yëf — Stock & Ventes Simplifiés',
    description: 'Gérez votre stock et vos ventes facilement, où que vous soyez.',
    type: 'website',
    locale: 'fr_SN',
  },
  icons: {
    icon: [
      { url: '/icons/icon-192x192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icons/icon-512x512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [
      { url: '/icons/icon-152x152.png', sizes: '152x152', type: 'image/png' },
      { url: '/icons/icon-192x192.png', sizes: '192x192', type: 'image/png' },
    ],
    shortcut: '/icons/icon-96x96.png',
  },
  robots: { index: true, follow: true },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#2D7D7D',
  viewportFit: 'cover',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={`${inter.variable} h-full`} suppressHydrationWarning>
      <head>
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="Saytu Yëf" />
        <meta name="format-detection" content="telephone=no" />
        <meta name="google" content="notranslate" />
        <link rel="apple-touch-icon" href="/icons/icon-192x192.png" />
      </head>
      <body className="min-h-full gradient-bg" suppressHydrationWarning>
        {children}
        <ServiceWorkerRegister />
      </body>
    </html>
  )
}
