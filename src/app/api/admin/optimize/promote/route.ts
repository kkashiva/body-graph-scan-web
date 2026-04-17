import { NextResponse } from 'next/server';
import { neonAuth } from '@neondatabase/auth/next/server';
import { sql } from '@/lib/db';
import { isAdmin } from '@/lib/admin';

type Body = { configId?: string };

export async function POST(request: Request) {
  const { user } = await neonAuth();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!(await isAdmin(user.id))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = (await request.json().catch(() => ({}))) as Body;
  if (typeof body.configId !== 'string') {
    return NextResponse.json({ error: 'configId is required' }, { status: 400 });
  }

  const target = (await sql`
    SELECT id, gender_target FROM analysis_configs WHERE id = ${body.configId}
  `) as { id: string; gender_target: string }[];
  if (target.length === 0) {
    return NextResponse.json({ error: 'config not found' }, { status: 404 });
  }
  const gender = target[0].gender_target;

  // Two-step toggle. The partial unique index
  // (analysis_configs.gender_target WHERE is_active = true) enforces that
  // only one row per gender ends up active — if a race produced two
  // promotions at once, the second INSERT will fail and we surface it.
  await sql`
    UPDATE analysis_configs
    SET is_active = false
    WHERE gender_target = ${gender} AND is_active = true
  `;
  await sql`
    UPDATE analysis_configs
    SET is_active = true
    WHERE id = ${body.configId}
  `;

  return NextResponse.json({ promoted: body.configId, gender });
}
