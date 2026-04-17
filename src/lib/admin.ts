import { sql } from '@/lib/db';

/**
 * Returns true if the given user has been granted admin access.
 *
 * Admin status lives on `user_profiles.is_admin` and is toggled manually
 * via Neon Studio — there is no UI for self-promotion. To grant access:
 *
 *   UPDATE user_profiles SET is_admin = true WHERE user_id = '<uuid>';
 */
export async function isAdmin(userId: string): Promise<boolean> {
  const rows = (await sql`
    SELECT is_admin FROM user_profiles WHERE user_id = ${userId}
  `) as { is_admin: boolean }[];
  return rows[0]?.is_admin === true;
}
