'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function ScoreAllButton({
  disabled,
  count,
}: {
  disabled: boolean;
  count: number;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  async function run() {
    setBusy(true);
    setMsg('');
    try {
      const res = await fetch('/api/admin/training/score-all', { method: 'POST' });
      const body = (await res.json()) as {
        scored?: number;
        failed?: number;
        total?: number;
        error?: string;
      };
      if (!res.ok) throw new Error(body.error || 'Scoring failed');
      setMsg(`Scored ${body.scored}/${body.total} (${body.failed} failed)`);
      router.refresh();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : 'Scoring failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-3">
      {msg && <span className="text-xs text-muted-foreground">{msg}</span>}
      <button
        type="button"
        onClick={run}
        disabled={disabled || busy}
        className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:opacity-90 disabled:opacity-50"
      >
        {busy ? 'Scoring…' : `Score all unscored${count ? ` (${count})` : ''}`}
      </button>
    </div>
  );
}
