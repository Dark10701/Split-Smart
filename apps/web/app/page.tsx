'use client';

import { useAuth } from '../lib/auth';

export default function Home() {
  const { token, ready } = useAuth();

  return (
    <div className="app-frame">
      <main className="container" style={{ paddingTop: 64, textAlign: 'center' }}>
        <div
          className="brand-mark"
          style={{ width: 64, height: 64, fontSize: 30, margin: '0 auto 20px' }}
          aria-hidden
        >
          S
        </div>
        <h1 style={{ fontSize: 30, lineHeight: 1.15, marginBottom: 12 }}>
          Split expenses.
          <br />
          Settle up over UPI.
        </h1>
        <p className="muted" style={{ fontSize: 15, margin: '0 auto 26px' }}>
          Track who paid for what across trips, flatmates, and dinners — then settle in two taps
          with any UPI app.
        </p>
        {ready && token ? (
          <a href="/groups" className="btn btn-primary btn-block">
            Go to your groups
          </a>
        ) : (
          <a href="/login" className="btn btn-primary btn-block">
            Get started
          </a>
        )}

        <div className="stack" style={{ margin: '32px 0 0', textAlign: 'left', gap: 10 }}>
          {[
            ['🧮', 'Fair splits', 'Equal, exact, %, shares, or itemized line items.'],
            ['⚡', 'Instant balances', 'See who owes whom with the fewest transfers.'],
            ['📲', 'UPI settle-up', 'Open GPay/PhonePe pre-filled and record it.'],
          ].map(([emoji, title, desc]) => (
            <div key={title} className="card card-pad row" style={{ gap: 14 }}>
              <span style={{ fontSize: 22 }} aria-hidden>
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
