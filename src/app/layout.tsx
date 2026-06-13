import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })

export const metadata: Metadata = {
  title: 'Saytu Yëf — Gestion de Stock & Ventes au Sénégal',
  description:
    'Application SaaS de gestion de stock et de ventes pour les entreprises sénégalaises. Wave, Orange Money intégrés. Entrée hors ligne depuis l\'étranger.',
  keywords: ['gestion stock', 'ventes', 'Sénégal', 'Wave', 'Orange Money', 'inventaire', 'POS'],
  authors: [{ name: 'Saytu Yëf' }],
  openGraph: {
    title: 'Saytu Yëf — Stock & Ventes Simplifiés',
    description: 'Gérez votre stock et vos ventes facilement, où que vous soyez.',
    type: 'website',
    locale: 'fr_SN',
  },
  robots: { index: true, follow: true },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  themeColor: '#080b14',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={`${inter.variable} h-full`}>
      <body className="min-h-full gradient-bg">{children}</body>
    </html>
  )
}
