import { redirect } from 'next/navigation';
import { neonAuth } from '@neondatabase/auth/next/server';
import { sql } from '@/lib/db';
import { ProfileForm } from './profile-form';

type ProfileRow = {
  gender: 'male' | 'female' | 'other' | null;
  date_of_birth: string | null;
  height_cm: string | null;
  weight_kg: string | null;
};

export default async function ProfilePage() {
  const { user } = await neonAuth();
  if (!user) redirect('/login');

  const rows = (await sql`
    SELECT gender, date_of_birth, height_cm, weight_kg
    FROM user_profiles
    WHERE user_id = ${user.id}
    LIMIT 1
  `) as ProfileRow[];

  const row = rows[0];
  const initial = {
    gender: row?.gender ?? '',
    // Neon returns DATE as "YYYY-MM-DD" already; normalize just in case.
    dateOfBirth: row?.date_of_birth ? String(row.date_of_birth).slice(0, 10) : '',
    heightCm: row?.height_cm ?? '',
    weightKg: row?.weight_kg ?? '',
  };

  return (
    <div className="mx-auto max-w-lg">
      <h1 className="text-3xl font-bold tracking-tight text-foreground">Profile</h1>
      <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
        These values are used as inputs to the body fat estimation pipeline. Height
        and weight are snapshotted into every scan so your trendlines stay accurate.
      </p>
      <ProfileForm initial={initial} />
    </div>
  );
}
