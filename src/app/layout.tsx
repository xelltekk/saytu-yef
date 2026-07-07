import type { Metadata, Viewport } from 'next'
import './globals.css'
import { ServiceWorkerRegister } from '@/components/pwa/ServiceWorkerRegister'
import { NetworkStatus } from '@/components/pwa/NetworkStatus'

export const metadata: Metadata = {
  applicationName: 'Saytu Yef',
  title: 'Saytu Yef - Gestion de Stock & Ventes au Senegal',
  description:
    "Application SaaS de gestion de stock et de ventes pour les entreprises senegalaises. Wave, Orange Money integres. Saisie hors ligne depuis l'etranger.",
  keywords: ['gestion stock', 'ventes', 'Senegal', 'Wave', 'Orange Money', 'inventaire', 'POS'],
  authors: [{ name: 'Saytu Yef' }],
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Saytu Yef',
    startupImage: [{ url: '/icons/icon-512x512.png' }],
  },
  openGraph: {
    title: 'Saytu Yef - Stock & Ventes simplifies',
    description: 'Gerez votre stock et vos ventes facilement, ou que vous soyez.',
    type: 'website',
    locale: 'fr_SN',
  },
  icons: {
    icon: [
      { url: '/brand/logo-saytu-yef-mark.png', type: 'image/png' },
      { url: '/icons/icon-192x192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icons/icon-512x512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [
      { url: '/brand/logo-saytu-yef-mark.png', type: 'image/png' },
      { url: '/icons/icon-152x152.png', sizes: '152x152', type: 'image/png' },
      { url: '/icons/icon-192x192.png', sizes: '192x192', type: 'image/png' },
    ],
    shortcut: '/brand/logo-saytu-yef-mark.png',
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
    <html lang="fr" translate="no" className="h-full notranslate" suppressHydrationWarning>
      <head>
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="Saytu Yef" />
        <meta name="format-detection" content="telephone=no" />
        <meta httpEquiv="Content-Language" content="fr" />
        <meta name="google" content="notranslate" />
        <link rel="icon" href="/brand/logo-saytu-yef-mark.png" type="image/png" />
        <link rel="apple-touch-icon" href="/brand/logo-saytu-yef-mark.png" />
      </head>
      <body className="min-h-full gradient-bg notranslate" translate="no" suppressHydrationWarning>
        {children}
        <NetworkStatus />
        <ServiceWorkerRegister />
      </body>
    </html>
  )
}
