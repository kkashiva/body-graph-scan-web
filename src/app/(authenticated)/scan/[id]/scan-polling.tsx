'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Polls the scan status and triggers a router refresh when it changes
 * from 'analyzing' to 'completed' or 'failed'.
 */
export function ScanPolling({ scanId }: { scanId: string }) {
  const router = useRouter();

  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/scan/${scanId}/status`);
        if (!res.ok) return;
        const { status } = (await res.json()) as { status: string };
        if (status === 'completed' || status === 'failed') {
          clearInterval(interval);
          router.refresh();
        }
      } catch {
        // Ignore fetch errors during polling
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [scanId, router]);

  return null;
}
