import { NextResponse } from 'next/server';
import { neonAuth } from '@neondatabase/auth/next/server';
import { sql } from '@/lib/db';

type ProfileRow = {
  gender: string | null;
  date_of_birth: string | null;
  height_cm: string | null;
  weight_kg: string | null;
};

export async function POST() {
  const { user } = await neonAuth();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const profile = (await sql`
    SELECT gender, date_of_birth, height_cm, weight_kg
    FROM user_profiles
    WHERE user_id = ${user.id}
    LIMIT 1
  `) as ProfileRow[];

  const p = profile[0];
  if (!p || !p.gender || !p.date_of_birth || !p.height_cm || !p.weight_kg) {
    return NextResponse.json(
      { error: 'Profile incomplete. Set gender, DOB, height, and weight first.' },
      { status: 400 },
    );
  }

  const rows = (await sql`
    INSERT INTO scans
      (user_id, status, height_cm_snapshot, weight_kg_snapshot)
    VALUES
      (${user.id}, 'uploading', ${p.height_cm}, ${p.weight_kg})
    RETURNING id
  `) as { id: string }[];

  return NextResponse.json({ id: rows[0].id });
}
