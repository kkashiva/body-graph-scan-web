'use client';

import { usePathname } from 'next/navigation';
import { authClient } from '@/lib/auth/client';

export function LogoutButton() {
  const pathname = usePathname();
  const { data: session } = authClient.useSession();

  if (pathname === '/login') return null;

  async function handleLogout() {
    await authClient.signOut();
    window.location.href = '/login';
  }

  const email = session?.user?.email;

  return (
    <div className="flex items-center gap-4">
      {email && (
        <span className="hidden text-xs font-medium text-muted-foreground sm:inline">
          {email}
        </span>
      )}
      <button
        onClick={handleLogout}
        className="rounded-lg border border-border bg-card px-4 py-1.5 text-xs font-semibold text-foreground transition-all hover:border-primary/50 hover:bg-accent active:scale-95"
      >
        Logout
      </button>
    </div>
  );
}
