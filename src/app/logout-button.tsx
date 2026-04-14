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
    <div className="flex items-center gap-2">
      {email && (
        <span className="text-xs text-gray-500">{email}</span>
      )}
      <button
        onClick={handleLogout}
        className="rounded-md bg-gray-100 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-200"
      >
        Logout
      </button>
    </div>
  );
}
