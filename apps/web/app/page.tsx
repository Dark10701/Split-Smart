'use client';

import { useAuth } from '../lib/auth';

export default function Home() {
  const { token, ready } = useAuth();

  return (
    <main>
      <section className="container" style={{ paddingTop: 72, textAlign: 'center' }}>
        <div
          className="brand-mark"
          style={{ width: 56, height: 56, fontSize: 30, margin: '0 auto 22px', borderRadius: 16 }}
        >
          S
        </div>
        <h1 style={{ fontSize: 40, lineHeight: 1.1, marginBottom: 14 }}>
          Split expenses.
          <br />
          Settle up over UPI.
        </h1>
        <p className="muted" style={{ fontSize: 17, maxWidth: 440, margin: '0 auto 28px' }}>
          Track who paid for what across trips, flatmates, and dinners — then settle in two taps
          with any UPI app. No more spreadsheets or awkward reminders.
        </p>
        <div className="row" style={{ justifyContent: 'center' }}>
          {ready && token ? (
            <a href="/groups" className="btn btn-primary" style={{ padding: '12px 22px' }}>
              Go to your groups →
            </a>
          ) : (
            <a href="/login" className="btn btn-primary" style={{ padding: '12px 22px' }}>
              Get started
            </a>
          )}
        </div>

        <div
          className="stack"
          style={{ maxWidth: 380, margin: '56px auto 0', textAlign: 'left', gap: 12 }}
        >
          {[
            ['🧮', 'Fair splits', 'Equal, exact, %, shares, or itemized line items.'],
            ['⚡', 'Instant balances', 'See who owes whom with the fewest transfers.'],
            ['📲', 'UPI settle-up', 'Open GPay/PhonePe pre-filled and record it.'],
          ].map(([emoji, title, desc]) => (
            <div key={title} className="card card-pad row" style={{ gap: 14 }}>
              <span style={{ fontSize: 22 }}>{emoji}</span>
              <div>
                <div style={{ fontWeight: 700 }}>{title}</div>
                <div className="muted" style={{ fontSize: 14 }}>
                  {desc}
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
