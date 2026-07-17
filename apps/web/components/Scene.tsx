/**
 * Decorative GPay-style landscape band for the dashboard: rolling hills, a
 * winding path, small buildings with lit windows, trees. Pure inline SVG —
 * every fill comes from theme variables (--sc-*), so it renders as a night
 * scene on the dark theme and a soft daytime scene on light. Purely
 * decorative (aria-hidden), scales with the frame width.
 */
export function Scene() {
  return (
    <svg
      className="scene"
      viewBox="0 0 460 168"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
      focusable="false"
    >
      {/* stars (visible on dark; transparent on light) */}
      <g fill="var(--sc-star)">
        <circle cx="52" cy="18" r="1.6" />
        <circle cx="128" cy="10" r="1.2" />
        <circle cx="212" cy="22" r="1.4" />
        <circle cx="315" cy="12" r="1.2" />
        <circle cx="398" cy="24" r="1.6" />
        <circle cx="255" cy="6" r="1" />
      </g>

      {/* back hill */}
      <path
        d="M0 96 C 70 58, 150 66, 230 88 C 310 110, 380 78, 460 60 L460 168 L0 168 Z"
        fill="var(--sc-hill)"
      />

      {/* right city cluster */}
      <g>
        <rect x="330" y="62" width="30" height="52" rx="2" fill="var(--sc-bld2)" />
        <rect x="366" y="46" width="34" height="68" rx="2" fill="var(--sc-bld)" />
        <rect x="408" y="70" width="44" height="44" rx="2" fill="var(--sc-bld2)" />
        <g fill="var(--sc-win)">
          <rect x="336" y="70" width="5" height="5" rx="1" />
          <rect x="348" y="70" width="5" height="5" rx="1" opacity="0.55" />
          <rect x="336" y="82" width="5" height="5" rx="1" opacity="0.4" />
          <rect x="348" y="94" width="5" height="5" rx="1" />
          <rect x="374" y="54" width="5" height="5" rx="1" />
          <rect x="386" y="54" width="5" height="5" rx="1" opacity="0.5" />
          <rect x="374" y="68" width="5" height="5" rx="1" opacity="0.65" />
          <rect x="386" y="82" width="5" height="5" rx="1" />
          <rect x="374" y="96" width="5" height="5" rx="1" opacity="0.4" />
          {/* diamond-lit facade */}
          <rect x="418" y="78" width="5" height="5" rx="1" transform="rotate(45 420.5 80.5)" />
          <rect
            x="432"
            y="78"
            width="5"
            height="5"
            rx="1"
            transform="rotate(45 434.5 80.5)"
            opacity="0.6"
          />
          <rect x="425" y="90" width="5" height="5" rx="1" transform="rotate(45 427.5 92.5)" />
          <rect
            x="439"
            y="90"
            width="5"
            height="5"
            rx="1"
            transform="rotate(45 441.5 92.5)"
            opacity="0.5"
          />
        </g>
      </g>

      {/* left buildings + pillared bank */}
      <g>
        <rect x="0" y="58" width="54" height="56" rx="2" fill="var(--sc-bld)" />
        <g fill="var(--sc-win)">
          <rect x="7" y="66" width="5" height="5" rx="1" />
          <rect x="19" y="66" width="5" height="5" rx="1" opacity="0.5" />
          <rect x="31" y="66" width="5" height="5" rx="1" />
          <rect x="43" y="66" width="5" height="5" rx="1" opacity="0.35" />
          <rect x="7" y="80" width="5" height="5" rx="1" opacity="0.6" />
          <rect x="31" y="80" width="5" height="5" rx="1" opacity="0.45" />
          <rect x="19" y="94" width="5" height="5" rx="1" />
        </g>
        {/* bank: plinth, four columns, pediment */}
        <g fill="var(--sc-teal)">
          <rect x="86" y="106" width="58" height="6" rx="2" />
          <rect x="92" y="82" width="6" height="24" rx="2" />
          <rect x="105" y="82" width="6" height="24" rx="2" />
          <rect x="118" y="82" width="6" height="24" rx="2" />
          <rect x="131" y="82" width="6" height="24" rx="2" />
          <path d="M84 82 L115 68 L146 82 Z" />
        </g>
      </g>

      {/* mid ground */}
      <path
        d="M0 118 C 90 96, 180 104, 260 118 C 330 130, 400 116, 460 104 L460 168 L0 168 Z"
        fill="var(--sc-ground)"
      />
      {/* winding path */}
      <path
        d="M198 168 C 210 148, 250 142, 300 138 C 350 134, 400 122, 442 108 L 460 108 L460 120 C 420 132, 370 144, 320 148 C 276 152, 240 158, 232 168 Z"
        fill="var(--sc-path)"
        opacity="0.85"
      />
      {/* foreground swell */}
      <path
        d="M0 150 C 60 138, 120 140, 180 150 C 240 160, 300 158, 460 148 L460 168 L0 168 Z"
        fill="var(--sc-ground2)"
      />

      {/* trees */}
      <g>
        <rect x="176" y="112" width="3" height="10" rx="1.5" fill="var(--sc-tree)" />
        <circle cx="177.5" cy="106" r="9" fill="var(--sc-tree)" />
        <rect x="298" y="120" width="3" height="9" rx="1.5" fill="var(--sc-tree)" />
        <circle cx="299.5" cy="115" r="7.5" fill="var(--sc-tree)" />
        <rect x="68" y="124" width="3" height="8" rx="1.5" fill="var(--sc-tree)" />
        <circle cx="69.5" cy="119" r="7" fill="var(--sc-tree)" />
      </g>
      {/* bushes */}
      <g fill="var(--sc-tree)" opacity="0.8">
        <ellipse cx="30" cy="152" rx="12" ry="5" />
        <ellipse cx="252" cy="156" rx="14" ry="5.5" />
        <ellipse cx="420" cy="150" rx="12" ry="5" />
      </g>
    </svg>
  );
}
