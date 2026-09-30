'use client';

import { useCallback, useEffect, useState } from 'react';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000/api';

type Health = { status: string; time: string; db: 'up' | 'down' };

export default function Home() {
  const [health, setHealth] = useState<Health | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const check = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/health`, { cache: 'no-store' });
      if (!res.ok) throw new Error(`API responded with ${res.status}`);
      setHealth((await res.json()) as Health);
    } catch (e) {
      setHealth(null);
      setError(e instanceof Error ? e.message : 'Could not reach the API');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void check();
  }, [check]);

  const ok = health?.status === 'ok' && health.db === 'up';

  return (
    <main className="min-h-screen bg-slate-50 p-8 flex items-center justify-center">
      <div className="w-full max-w-xl rounded-2xl bg-white p-8 shadow-sm ring-1 ring-slate-200">
        <p className="text-sm font-semibold uppercase tracking-wide text-violet-600">
          GuessUp
        </p>
        <h1 className="mt-1 text-2xl font-bold text-slate-900">Administrator Panel</h1>
        <p className="mt-2 text-sm text-slate-600">
          Question bank, categories, students, game sessions and reports are added in the next
          steps. This page only checks that the panel can reach the API.
        </p>

        <div className="mt-6 rounded-xl border border-slate-200 p-4">
          <div className="flex items-center gap-3">
            <span
              className={`inline-block h-3 w-3 rounded-full ${
                loading ? 'bg-amber-400' : ok ? 'bg-emerald-500' : 'bg-red-500'
              }`}
            />
            <span className="font-semibold text-slate-900">
              {loading ? 'Checking the API…' : ok ? 'API reachable' : 'API unreachable'}
            </span>
          </div>

          <dl className="mt-4 space-y-1 text-sm text-slate-600">
            <div className="flex justify-between gap-4">
              <dt>API URL</dt>
              <dd className="font-mono text-xs text-slate-900">{API_URL}</dd>
            </div>
            {health && (
              <>
                <div className="flex justify-between gap-4">
                  <dt>Database</dt>
                  <dd className="font-semibold text-slate-900">{health.db}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt>Server time</dt>
                  <dd className="text-slate-900">{new Date(health.time).toLocaleString()}</dd>
                </div>
              </>
            )}
            {error && <p className="pt-2 text-red-600">{error}</p>}
          </dl>

          <button
            onClick={() => void check()}
            className="mt-5 rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700"
          >
            Check again
          </button>
        </div>

        <p className="mt-6 text-xs text-slate-500">
          Start the API first: <code className="font-mono">cd api &amp;&amp; npm run start:dev</code>.
          Set a different address in <code className="font-mono">.env.local</code> with
          <code className="font-mono"> NEXT_PUBLIC_API_URL</code>.
        </p>
      </div>
    </main>
  );
}
