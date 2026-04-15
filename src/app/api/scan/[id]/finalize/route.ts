import { NextResponse } from 'next/server';
import { neonAuth } from '@neondatabase/auth/next/server';
import { sql } from '@/lib/db';

type Body = {
  frontImageUrl?: string;
  profileImageUrl?: string;
};

function isValidBlobUrl(url: string | undefined): url is string {
  if (typeof url !== 'string') return false;
  try {
    const u = new URL(url);
    // Vercel Blob URLs end in .public.blob.vercel-storage.com
    return (
      u.protocol === 'https:' &&
      u.hostname.endsWith('.public.blob.vercel-storage.com')
    );
  } catch {
    return false;
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { user } = await neonAuth();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const body = (await request.json().catch(() => ({}))) as Body;

  if (!isValidBlobUrl(body.frontImageUrl) || !isValidBlobUrl(body.profileImageUrl)) {
    return NextResponse.json(
      { error: 'frontImageUrl and profileImageUrl must be Vercel Blob URLs' },
      { status: 400 },
    );
  }

  const rows = (await sql`
    UPDATE scans
       SET front_image_url   = ${body.frontImageUrl},
           profile_image_url = ${body.profileImageUrl},
           status            = 'analyzing'
     WHERE id      = ${id}
       AND user_id = ${user.id}
       AND status  IN ('pending', 'uploading')
    RETURNING id
  `) as { id: string }[];

  if (rows.length === 0) {
    return NextResponse.json(
      { error: 'Scan not found or not in a state that can be finalized' },
      { status: 404 },
    );
  }

  // Phase 3 will dispatch the LangGraph pipeline here.

  return NextResponse.json({ id: rows[0].id });
}
