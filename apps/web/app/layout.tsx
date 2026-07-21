import type { ReactNode } from 'react';
import type { Metadata, Viewport } from 'next';
import './globals.css';
import { Providers } from './providers';
import { Splash } from '../components/Splash';

export const metadata: Metadata = {
  title: 'SplitSmart — Split expenses, settle over UPI',
  description: 'Track shared group expenses and settle up over UPI. India-first.',
  manifest: '/manifest.webmanifest',
  applicationName: 'SplitSmart',
  icons: {
    icon: [{ url: '/icon.svg', type: 'image/svg+xml' }],
    // iOS home-screen icon. SVG is best-effort (newer iOS); for a pixel-perfect
    // icon on all iOS, drop a 180×180 apple-touch-icon.png in /public and point
    // `apple` at it (one-time, needs an image tool — no network at build here).
    apple: [{ url: '/maskable.svg' }],
  },
  // Installed (home-screen) mode: full-screen, own title.
  appleWebApp: { capable: true, title: 'SplitSmart', statusBarStyle: 'black-translucent' },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  // Match the theme both ways so the status bar / address bar blends in.
  themeColor: [
    { media: '(prefers-color-scheme: dark)', color: '#0f1115' },
    { media: '(prefers-color-scheme: light)', color: '#eaf1fd' },
  ],
  width: 'device-width',
  initialScale: 1,
  // Fill the notch/safe areas when installed to the home screen.
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" data-theme="dark" suppressHydrationWarning>
      <head>
        {/* Restore the saved theme before first paint to avoid a flash. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var t=localStorage.getItem('theme');if(t)document.documentElement.dataset.theme=t;}catch(e){}`,
          }}
        />
      </head>
      <body>
        <Splash />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
