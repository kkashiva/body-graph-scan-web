'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function PromoteButton({ configId }: { configId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  async function promote() {
    setBusy(true);
    setErr('');
    try {
      const res = await fetch('/api/admin/optimize/promote', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ configId }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || 'Promote failed');
      }
      router.refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Promote failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      {err && <span className="text-xs text-red-600">{err}</span>}
      <button
        type="button"
        onClick={promote}
        disabled={busy}
        className="rounded-full border border-primary px-3 py-1 text-xs font-semibold text-primary transition-colors hover:bg-primary hover:text-primary-foreground disabled:opacity-50"
      >
        {busy ? 'Promoting…' : 'Promote to active'}
      </button>
    </div>
  );
}
