import type { ReactNode } from 'react';

export const metadata = {
  title: 'SplitSmart',
  description: 'Track and settle shared group expenses.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: 'system-ui, sans-serif', margin: 0 }}>{children}</body>
    </html>
  );
}
