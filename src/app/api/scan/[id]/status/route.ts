import { NextResponse } from 'next/server';
import { neonAuth } from '@neondatabase/auth/next/server';
import { sql } from '@/lib/db';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { user } = await neonAuth();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  const rows = (await sql`
    SELECT status FROM scans
    WHERE id = ${id} AND user_id = ${user.id}
  `) as { status: string }[];

  if (rows.length === 0) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  return NextResponse.json({ status: rows[0].status });
}
