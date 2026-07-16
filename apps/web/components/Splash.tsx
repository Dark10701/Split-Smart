'use client';

import { useEffect, useState } from 'react';

/**
 * App-open splash (Splitwise-style): the brand mark pops in, then the cover
 * fades away to reveal the app. Plays once per browser session — client-side
 * navigations never replay it — and is skipped entirely for reduced motion
 * (the CSS also hides it as a belt-and-braces).
 */
export function Splash() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    try {
      if (sessionStorage.getItem('splash-played')) return;
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
      sessionStorage.setItem('splash-played', '1');
    } catch {
      return; // storage blocked — skip rather than replay forever
    }
    setShow(true);
    // Unmount after the CSS fade (1.15s delay + 0.45s fade) completes.
    const t = setTimeout(() => setShow(false), 1700);
    return () => clearTimeout(t);
  }, []);

  if (!show) return null;
  return (
    <div className="splash" aria-hidden>
      <div className="splash-inner">
        <span className="brand-mark">S</span>
        <div className="splash-name">SplitSmart</div>
        <div className="splash-tag">Split expenses. Settle over UPI.</div>
      </div>
    </div>
  );
}
