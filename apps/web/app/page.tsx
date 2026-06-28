const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

async function getHealth(): Promise<string> {
  try {
    const res = await fetch(`${API_URL}/health`, { cache: 'no-store' });
    if (!res.ok) return 'unreachable';
    const data = (await res.json()) as { status: string };
    return data.status;
  } catch {
    return 'unreachable';
  }
}

export default async function Home() {
  const health = await getHealth();
  return (
    <main style={{ padding: 32 }}>
      <h1>SplitSmart</h1>
      <p>Web client scaffold (Milestone 0).</p>
      <p>
        API health: <strong>{health}</strong>
      </p>
    </main>
  );
}
