'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../lib/auth';
import { BrandMark } from '../components/BrandMark';

/**
 * Entry point. There is no marketing landing page — opening the app takes you
 * straight to your groups if signed in, or to the login screen if not. The
 * brand mark shown here is just a placeholder under the splash while auth
 * state resolves and the redirect fires.
 */
export default function Home() {
  const { token, ready } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!ready) return;
    router.replace(token ? '/groups' : '/login');
  }, [ready, token, router]);

  return (
    <div className="app-frame">
      <main
        className="container"
        style={{ display: 'grid', placeItems: 'center', minHeight: '60vh' }}
      >
        <BrandMark style={{ width: 72, height: 72 }} />
      </main>
    </div>
  );
}
