import type { Metadata, Viewport } from 'next';
import { AuthProvider } from '@/lib/auth';
import { I18nProvider } from '@/i18n/provider';
import { ConnectionProvider } from '@/lib/connection';
import { PwaRegister } from '@/components/PwaRegister';
import './globals.css';

export const metadata: Metadata = {
  title: 'NexPlay — Jeux compétitifs',
  description:
    'Plateforme mondiale de jeux compétitifs. Lancez une partie de Ludo ou Dames, défiez le monde.',
  applicationName: 'NexPlay',
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'NexPlay',
  },
  icons: {
    icon: [
      { url: '/icons/icon.svg', type: 'image/svg+xml' },
      { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
    ],
    apple: [{ url: '/icons/icon-192.png', sizes: '192x192' }],
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#0b1a14',
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Syne:wght@700;800&display=swap"
          rel="stylesheet"
        />
        <meta name="mobile-web-app-capable" content="yes" />
      </head>
      <body>
        <ConnectionProvider>
          <I18nProvider>
            <AuthProvider>
              <div style={{ position: 'fixed', top: 10, right: 10, zIndex: 50 }}>
                <PwaRegister />
              </div>
              {children}
            </AuthProvider>
          </I18nProvider>
        </ConnectionProvider>
      </body>
    </html>
  );
}
