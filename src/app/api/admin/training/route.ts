import { NextResponse } from 'next/server';
import { neonAuth } from '@neondatabase/auth/next/server';
import { sql } from '@/lib/db';
import { isAdmin } from '@/lib/admin';

type Body = {
  frontImageUrl?: string;
  profileImageUrl?: string;
  knownBfPct?: number;
  gender?: 'male' | 'female';
  heightCm?: number;
  weightKg?: number;
  source?: string;
};

function isValidBlobUrl(url: string | undefined): url is string {
  if (typeof url !== 'string') return false;
  try {
    const u = new URL(url);
    return (
      u.protocol === 'https:' &&
      u.hostname.endsWith('.public.blob.vercel-storage.com')
    );
  } catch {
    return false;
  }
}

export async function POST(request: Request) {
  const { user } = await neonAuth();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!(await isAdmin(user.id))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = (await request.json().catch(() => ({}))) as Body;

  if (!isValidBlobUrl(body.frontImageUrl) || !isValidBlobUrl(body.profileImageUrl)) {
    return NextResponse.json(
      { error: 'frontImageUrl and profileImageUrl must be Vercel Blob URLs' },
      { status: 400 },
    );
  }
  if (body.gender !== 'male' && body.gender !== 'female') {
    return NextResponse.json({ error: 'gender must be male or female' }, { status: 400 });
  }
  if (
    typeof body.knownBfPct !== 'number' ||
    body.knownBfPct < 3 ||
    body.knownBfPct > 55
  ) {
    return NextResponse.json(
      { error: 'knownBfPct must be a number in [3, 55]' },
      { status: 400 },
    );
  }

  const rows = (await sql`
    INSERT INTO training_scans
      (user_id, front_image_url, profile_image_url, known_bf_pct,
       gender, height_cm, weight_kg, source)
    VALUES
      (${user.id}, ${body.frontImageUrl}, ${body.profileImageUrl}, ${body.knownBfPct},
       ${body.gender}, ${body.heightCm ?? null}, ${body.weightKg ?? null},
       ${body.source ?? null})
    RETURNING id
  `) as { id: string }[];

  return NextResponse.json({ id: rows[0].id });
}
