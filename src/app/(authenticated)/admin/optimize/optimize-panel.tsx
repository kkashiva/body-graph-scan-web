'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function OptimizePanel() {
  return (
    <div className="flex flex-wrap gap-3 rounded-2xl border border-border bg-card p-5">
      <RunButton gender="male" />
      <RunButton gender="female" />
    </div>
  );
}

function RunButton({ gender }: { gender: 'male' | 'female' }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  async function run() {
    setBusy(true);
    setMsg('');
    try {
      const res = await fetch('/api/admin/optimize', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ gender }),
      });
      const body = (await res.json()) as {
        baselineMse?: number;
        finalMse?: number;
        sampleCount?: number;
        iterations?: number;
        error?: string;
      };
      if (!res.ok) throw new Error(body.error || 'Optimize failed');
      setMsg(
        `${body.sampleCount} samples · MSE ${body.baselineMse?.toFixed(2)} → ${body.finalMse?.toFixed(2)} (${body.iterations} iters)`,
      );
      router.refresh();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Optimize failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={run}
        disabled={busy}
        className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:opacity-90 disabled:opacity-50"
      >
        {busy ? `Optimizing ${gender}…` : `Optimize ${gender}`}
      </button>
      {msg && <span className="text-xs text-muted-foreground">{msg}</span>}
    </div>
  );
}
