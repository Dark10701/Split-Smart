export default function NotFound() {
  return (
    <div className="app-frame">
      <main className="container" style={{ paddingTop: 80 }}>
        <div className="card empty">
          <div className="empty-emoji">🔍</div>
          <div style={{ fontWeight: 700, fontSize: 18, color: 'var(--text)' }}>Page not found</div>
          <div style={{ marginTop: 4 }}>That page doesn&apos;t exist.</div>
          <a href="/groups" className="btn btn-primary btn-sm" style={{ marginTop: 16 }}>
            Go home
          </a>
        </div>
      </main>
    </div>
  );
}
