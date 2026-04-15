import Link from 'next/link';
import { redirect } from 'next/navigation';
import { neonAuth } from '@neondatabase/auth/next/server';
import { sql } from '@/lib/db';
import { ScanCapture } from './scan-capture';

type ProfileRow = {
  gender: string | null;
  date_of_birth: string | null;
  height_cm: string | null;
  weight_kg: string | null;
};

export default async function NewScanPage() {
  const { user } = await neonAuth();
  if (!user) redirect('/login');

  const rows = (await sql`
    SELECT gender, date_of_birth, height_cm, weight_kg
    FROM user_profiles
    WHERE user_id = ${user.id}
    LIMIT 1
  `) as ProfileRow[];

  const p = rows[0];
  const profileComplete = !!(
    p?.gender &&
    p?.date_of_birth &&
    p?.height_cm &&
    p?.weight_kg
  );

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900">New Scan</h1>
      <p className="mt-2 text-sm text-gray-500">
        Capture front and profile photos. Align your body inside the silhouette
        overlay — it&apos;s what the VLM pipeline crops against.
      </p>

      {!profileComplete ? (
        <div className="mt-6 rounded-md border border-amber-200 bg-amber-50 p-4">
          <p className="text-sm font-medium text-amber-900">
            Finish your profile first
          </p>
          <p className="mt-1 text-sm text-amber-800">
            Gender, date of birth, height, and weight are required — they feed
            the Navy formula and are snapshotted into each scan.
          </p>
          <Link
            href="/profile"
            className="mt-3 inline-block rounded-md bg-amber-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-800"
          >
            Go to profile
          </Link>
        </div>
      ) : (
        <div className="mt-6">
          <ScanCapture gender={p.gender} />
        </div>
      )}
    </div>
  );
}
