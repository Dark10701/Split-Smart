import type { MetadataRoute } from 'next';

/**
 * PWA manifest — lets SplitSmart install to the home screen and open
 * full-screen like a native app. Served at /manifest.webmanifest.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'SplitSmart — Split expenses, settle over UPI',
    short_name: 'SplitSmart',
    description:
      'Track shared group expenses and settle up over UPI. Fair splits, instant balances, one-tap payments.',
    id: '/',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#0f1115',
    theme_color: '#0f1115',
    categories: ['finance', 'productivity'],
    icons: [
      { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
      { src: '/maskable.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'maskable' },
    ],
    shortcuts: [
      { name: 'Your groups', url: '/groups' },
      { name: 'Friends', url: '/friends' },
      { name: 'My UPI QR', url: '/upi' },
    ],
  };
}
