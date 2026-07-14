'use client';

import { useEffect, useId, useRef, type ReactNode } from 'react';
import { avatarFor } from '../lib/api';

/** Colored circular initials avatar for a member/person (decorative). */
export function Avatar({ name, size = 40 }: { name: string; size?: number }) {
  const { color, initials } = avatarFor(name);
  return (
    <span
      className="avatar"
      style={{ background: color, width: size, height: size, fontSize: size * 0.38 }}
      aria-hidden
    >
      {initials}
    </span>
  );
}

function Icon({ path }: { path: string }) {
  return (
    <svg
      className="nav-icon"
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden
    >
      <path d={path} />
    </svg>
  );
}

const ICONS = {
  home: 'M12 3l9 8h-3v9h-4v-6h-4v6H6v-9H3l9-8z',
  profile: 'M12 12a4 4 0 100-8 4 4 0 000 8zm0 2c-4 0-8 2-8 5v1h16v-1c0-3-4-5-8-5z',
};

/** GPay-style bottom navigation bar shown on the home/profile tabs. */
export function BottomNav({ active }: { active: 'home' | 'profile' }) {
  const items = [
    { key: 'home' as const, label: 'Home', href: '/groups', path: ICONS.home },
    { key: 'profile' as const, label: 'Profile', href: '/profile', path: ICONS.profile },
  ];
  return (
    <nav className="bottom-nav" aria-label="Primary">
      {items.map((it) => (
        <a
          key={it.key}
          href={it.href}
          className={`nav-item${active === it.key ? ' active' : ''}`}
          aria-current={active === it.key ? 'page' : undefined}
        >
          <Icon path={it.path} />
          {it.label}
        </a>
      ))}
    </nav>
  );
}

/**
 * App shell: a phone-width frame with a top bar and (optionally) a bottom nav,
 * so the web app reads like a mobile app rather than a website. Pass `back` for
 * a sub-page (back arrow, no bottom nav) or `active` for a root tab (bottom nav).
 */
export function AppShell({
  title,
  active,
  back,
  headerRight,
  children,
}: {
  title: string;
  active?: 'home' | 'profile';
  back?: string;
  headerRight?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="app-frame">
      <header className="topbar">
        <div className="topbar-title">
          {back ? (
            <a
              href={back}
              aria-label="Back"
              style={{ color: 'var(--text)', fontSize: 22, lineHeight: 1 }}
            >
              ←
            </a>
          ) : (
            <span className="brand-mark" aria-hidden>
              S
            </span>
          )}
          {title}
        </div>
        <div className="row">{headerRight}</div>
      </header>
      <main className="container">{children}</main>
      {active && <BottomNav active={active} />}
    </div>
  );
}

/**
 * Accessible modal, presented as a bottom sheet on the app frame (M6-15/16):
 * `role="dialog"` + `aria-modal` + `aria-labelledby`; Escape and backdrop-click
 * dismiss; focus moves into the dialog on open and returns on close.
 */
export function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    dialogRef.current?.focus();
    const onKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      previouslyFocused?.focus?.();
    };
  }, [onClose]);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        ref={dialogRef}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="between" style={{ marginBottom: 16 }}>
          <h2 id={titleId} style={{ fontSize: 19 }}>
            {title}
          </h2>
          <button className="btn btn-ghost btn-sm" onClick={onClose} aria-label="Close dialog">
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
