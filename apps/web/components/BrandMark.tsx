import type { CSSProperties } from 'react';

/**
 * SplitSmart's shared brand mark. The two upper dots and joining path represent
 * a shared expense becoming one clear settlement.
 */
export function BrandMark({
  className = '',
  style,
}: {
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <svg
      className={`brand-mark ${className}`.trim()}
      style={style}
      viewBox="0 0 32 32"
      role="img"
      aria-label="SplitSmart"
    >
      <defs>
        <linearGradient
          id="split-smart-mark"
          x1="5"
          y1="4"
          x2="28"
          y2="29"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#2563EB" />
          <stop offset="1" stopColor="#7C3AED" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="9" fill="url(#split-smart-mark)" />
      <circle cx="10.5" cy="11" r="2.5" fill="white" />
      <circle cx="21.5" cy="11" r="2.5" fill="white" fillOpacity="0.88" />
      <path
        d="M10.5 17v1.1c0 1.05.85 1.9 1.9 1.9h7.2c1.05 0 1.9.85 1.9 1.9V24"
        fill="none"
        stroke="white"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M21.5 17v3" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
      <circle cx="21.5" cy="24" r="2.5" fill="white" />
      <path d="M20.35 24h2.3" stroke="#5B39D5" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}
