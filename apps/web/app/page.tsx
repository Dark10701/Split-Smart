'use client';

import { useAuth } from '../lib/auth';

export default function Home() {
  const { token, ready } = useAuth();

  return (
    <div className="app-frame">
      <main className="container" style={{ paddingTop: 72, textAlign: 'center' }}>
        <div
          className="brand-mark"
          style={{
            width: 80,
            height: 80,
            fontSize: 38,
            margin: '0 auto 24px',
            animation: 'float 4s ease-in-out infinite',
            boxShadow: '0 0 40px rgba(79, 195, 247, 0.35)',
          }}
          aria-hidden
        >
          S
        </div>
        <h1
          style={{
            fontSize: 34,
            lineHeight: 1.15,
            marginBottom: 14,
            background: 'linear-gradient(120deg, var(--text), var(--primary))',
            WebkitBackgroundClip: 'text',
            backgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}
        >
          Split expenses.
          <br />
          Settle up over UPI.
        </h1>
        <p className="muted" style={{ fontSize: 15, margin: '0 auto 28px' }}>
          Track who paid for what across trips, flatmates, and dinners — then settle in two taps
          with any UPI app.
        </p>
        {ready && token ? (
          <a href="/groups" className="btn btn-primary btn-block" style={{ padding: '14px 20px' }}>
            Go to your groups
          </a>
        ) : (
          <a href="/login" className="btn btn-primary btn-block" style={{ padding: '14px 20px' }}>
            Get started
          </a>
        )}

        <div className="stack" style={{ margin: '32px 0 0', textAlign: 'left', gap: 12 }}>
          {[
            ['🧮', 'Fair splits', 'Equal, exact, %, shares, or itemized line items.'],
            ['⚡', 'Instant balances', 'See who owes whom with the fewest transfers.'],
            ['📲', 'UPI settle-up', 'Open GPay/PhonePe pre-filled and record it.'],
          ].map(([emoji, title, desc]) => (
            <div key={title} className="card card-pad card-hover row" style={{ gap: 14 }}>
              <span
                aria-hidden
                style={{
                  fontSize: 22,
                  width: 46,
                  height: 46,
                  borderRadius: 14,
                  display: 'grid',
                  placeItems: 'center',
                  background: 'var(--primary-soft)',
                  flexShrink: 0,
                }}
              >
                {emoji}
              </span>
              <div>
                <div style={{ fontWeight: 700 }}>{title}</div>
                <div className="muted" style={{ fontSize: 14 }}>
                  {desc}
                </div>
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
