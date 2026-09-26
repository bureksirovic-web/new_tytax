import type { Metadata, Viewport } from 'next';
import { Inter, Oswald, JetBrains_Mono } from 'next/font/google';
import './globals.css';
import { Providers } from '@/components/providers';
import { ServiceWorker } from '@/components/layout/service-worker';

const inter = Inter({ subsets: ['latin'], variable: '--font-sans' });
const oswald = Oswald({ subsets: ['latin'], variable: '--font-display' });
const jetBrainsMono = JetBrains_Mono({ subsets: ['latin'], variable: '--font-mono' });

export const metadata: Metadata = {
  title: 'TYTAX — trening',
  description: 'TYTAX T1, trening s vlastitom težinom i kettlebellom',
  manifest: '/manifest.json',
  icons: {
    icon: [{ url: '/icons/icon.svg', type: 'image/svg+xml' }],
    apple: [{ url: '/icons/apple-touch-icon.png', sizes: '180x180' }],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'TYTAX',
  },
};

export const viewport: Viewport = {
  themeColor: '#0a0f1a',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="hr" data-theme="tactical" suppressHydrationWarning>
      <body className={`${inter.variable} ${oswald.variable} ${jetBrainsMono.variable}`}>
        <Providers>{children}</Providers>
        <ServiceWorker />
      </body>
    </html>
  );
}
