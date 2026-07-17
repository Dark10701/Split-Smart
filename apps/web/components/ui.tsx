'use client';

import { useEffect, useId, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { avatarFor } from '../lib/api';
import { BrandMark } from './BrandMark';

/** Shimmer placeholder for loading states. */
export function Skeleton({ className = '', style }: { className?: string; style?: CSSProperties }) {
  return <div className={`skeleton ${className}`} style={style} aria-hidden />;
}

export interface ToastState {
  message: string;
  kind: 'success' | 'error';
}

/**
 * Lightweight toast for success/error microfeedback. Render `<Toast toast={t}
 * onDone={() => setT(null)} />` near the page root and set state to show one;
 * it auto-dismisses. Announced politely for screen readers.
 */
export function Toast({
  toast,
  onDone,
  ms = 2600,
}: {
  toast: ToastState | null;
  onDone: () => void;
  ms?: number;
}) {
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(onDone, ms);
    return () => clearTimeout(t);
  }, [toast, ms, onDone]);
  if (!toast) return null;
  return (
    <div className="toast-wrap" role="status" aria-live="polite">
      <div className={`toast toast-${toast.kind}`}>
        <span className="toast-dot" aria-hidden>
          {toast.kind === 'success' ? '✓' : '!'}
        </span>
        {toast.message}
      </div>
    </div>
  );
}

/** A card of shimmer rows, used while a list is loading. */
export function SkeletonList({ rows = 4 }: { rows?: number }) {
  return (
    <div className="card card-pad" aria-busy="true" aria-label="Loading">
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="skeleton-row" />
      ))}
    </div>
  );
}

/** Error card with a retry action, used when a fetch fails. */
export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="card empty" role="alert">
      <div className="empty-emoji" style={{ background: 'var(--negative-soft)' }}>
        ⚠️
      </div>
      <div style={{ fontWeight: 600, color: 'var(--text)' }}>{message}</div>
      <div className="faint" style={{ fontSize: 13, marginTop: 4 }}>
        Check that the API is running, then try again.
      </div>
      {onRetry && (
        <button className="btn btn-ghost btn-sm" style={{ marginTop: 14 }} onClick={onRetry}>
          Retry
        </button>
      )}
    </div>
  );
}

/** Dark/light theme toggle switch, persisted to localStorage. */
export function ThemeToggle() {
  const [dark, setDark] = useState(true);
  useEffect(() => {
    setDark((document.documentElement.dataset.theme ?? 'dark') !== 'light');
  }, []);
  const toggle = (): void => {
    const next = dark ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem('theme', next);
    } catch {
      /* ignore */
    }
    setDark(!dark);
  };
  return (
    <button
      type="button"
      role="switch"
      aria-checked={dark}
      aria-label="Dark mode"
      className="switch"
      data-on={dark ? 'true' : 'false'}
      onClick={toggle}
    />
  );
}

/** Colored circular initials avatar for a member/person (decorative).
 *  `color` overrides the name-hash color when the user picked one. */
export function Avatar({
  name,
  size = 40,
  color,
}: {
  name: string;
  size?: number;
  color?: string | null;
}) {
  const derived = avatarFor(name);
  return (
    <span
      className="avatar"
      style={{
        background: color ?? derived.color,
        width: size,
        height: size,
        fontSize: size * 0.38,
      }}
      aria-hidden
    >
      {derived.initials}
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
  friends:
    'M16 11a3 3 0 100-6 3 3 0 000 6zm-8 0a3 3 0 100-6 3 3 0 000 6zm0 2c-2.7 0-6 1.3-6 4v1h8v-1c0-1 .4-1.9 1-2.6-.9-.3-2-.4-3-.4zm8 0c-.3 0-.6 0-1 .1 1 .8 1.5 1.8 1.5 2.9v1H22v-1c0-2.7-3.3-4-6-4z',
  profile: 'M12 12a4 4 0 100-8 4 4 0 000 8zm0 2c-4 0-8 2-8 5v1h16v-1c0-3-4-5-8-5z',
};

export type NavTab = 'home' | 'friends' | 'profile';

/** GPay-style bottom navigation bar shown on the root tabs. */
export function BottomNav({ active }: { active: NavTab }) {
  const items = [
    { key: 'home' as const, label: 'Groups', href: '/groups', path: ICONS.home },
    { key: 'friends' as const, label: 'Friends', href: '/friends', path: ICONS.friends },
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
  active?: NavTab;
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
            <BrandMark />
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

/** Confirmation dialog for destructive actions (e.g. deleting an expense). */
export function ConfirmDialog({
  title,
  message,
  confirmLabel = 'Delete',
  onConfirm,
  onCancel,
}: {
  title: string;
  message: string;
  confirmLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <Modal title={title} onClose={onCancel}>
      <p className="muted" style={{ marginTop: 0 }}>
        {message}
      </p>
      <div className="row" style={{ marginTop: 16 }}>
        <button className="btn btn-ghost btn-block" onClick={onCancel}>
          Cancel
        </button>
        <button className="btn btn-danger btn-block" onClick={onConfirm}>
          {confirmLabel}
        </button>
      </div>
    </Modal>
  );
}
