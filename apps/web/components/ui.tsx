'use client';

import type { ReactNode } from 'react';
import { avatarFor } from '../lib/api';

/** Colored circular initials avatar for a member/person. */
export function Avatar({ name, size = 34 }: { name: string; size?: number }) {
  const { color, initials } = avatarFor(name);
  return (
    <span
      className="avatar"
      style={{ background: color, width: size, height: size, fontSize: size * 0.4 }}
      aria-hidden
    >
      {initials}
    </span>
  );
}

/** Sticky top app bar with the SplitSmart brand and optional right-side actions. */
export function AppBar({ children }: { children?: ReactNode }) {
  return (
    <header className="app-bar">
      <div className="app-bar-inner">
        <a href="/groups" className="brand">
          <span className="brand-mark">S</span>
          SplitSmart
        </a>
        <div className="row">{children}</div>
      </div>
    </header>
  );
}

/** Centered modal dialog. Click the backdrop or Esc-equivalent close button to dismiss. */
export function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="between" style={{ marginBottom: 16 }}>
          <h2 style={{ fontSize: 19 }}>{title}</h2>
          <button className="btn btn-ghost btn-sm" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
