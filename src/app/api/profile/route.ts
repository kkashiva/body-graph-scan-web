import { NextResponse } from 'next/server';
import { neonAuth } from '@neondatabase/auth/next/server';
import { sql } from '@/lib/db';

const GENDERS = new Set(['male', 'female', 'other']);

function parseBody(body: unknown) {
  if (!body || typeof body !== 'object') {
    return { error: 'Invalid body' } as const;
  }
  const b = body as Record<string, unknown>;

  const gender = typeof b.gender === 'string' ? b.gender : '';
  if (!GENDERS.has(gender)) {
    return { error: 'gender must be male | female | other' } as const;
  }

  const dateOfBirth = typeof b.dateOfBirth === 'string' ? b.dateOfBirth : '';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateOfBirth)) {
    return { error: 'dateOfBirth must be YYYY-MM-DD' } as const;
  }
  const dob = new Date(dateOfBirth);
  if (Number.isNaN(dob.getTime()) || dob > new Date()) {
    return { error: 'dateOfBirth must be a valid past date' } as const;
  }

  const heightCm = Number(b.heightCm);
  if (!Number.isFinite(heightCm) || heightCm < 50 || heightCm > 260) {
    return { error: 'heightCm must be between 50 and 260' } as const;
  }

  const weightKg = Number(b.weightKg);
  if (!Number.isFinite(weightKg) || weightKg < 20 || weightKg > 400) {
    return { error: 'weightKg must be between 20 and 400' } as const;
  }

  return { gender, dateOfBirth, heightCm, weightKg } as const;
}

export async function POST(request: Request) {
  const { user } = await neonAuth();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const parsed = parseBody(await request.json().catch(() => null));
  if ('error' in parsed) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  await sql`
    INSERT INTO user_profiles
      (user_id, gender, date_of_birth, height_cm, weight_kg, updated_at)
    VALUES
      (${user.id}, ${parsed.gender}, ${parsed.dateOfBirth},
       ${parsed.heightCm}, ${parsed.weightKg}, now())
    ON CONFLICT (user_id) DO UPDATE SET
      gender        = EXCLUDED.gender,
      date_of_birth = EXCLUDED.date_of_birth,
      height_cm     = EXCLUDED.height_cm,
      weight_kg     = EXCLUDED.weight_kg,
      updated_at    = now()
  `;

  return NextResponse.json({ ok: true });
}
