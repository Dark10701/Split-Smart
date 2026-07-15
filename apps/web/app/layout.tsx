import type { ReactNode } from 'react';
import type { Metadata, Viewport } from 'next';
import './globals.css';
import { Providers } from './providers';

export const metadata: Metadata = {
  title: 'SplitSmart — Split expenses, settle over UPI',
  description: 'Track shared group expenses and settle up over UPI. India-first.',
};

export const viewport: Viewport = {
  themeColor: '#1a1a2e',
  width: 'device-width',
  initialScale: 1,
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
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
