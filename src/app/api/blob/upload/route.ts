import { NextResponse } from 'next/server';
import { handleUpload, type HandleUploadBody } from '@vercel/blob/client';
import { neonAuth } from '@neondatabase/auth/next/server';
import { sql } from '@/lib/db';

export async function POST(request: Request) {
  const { user } = await neonAuth();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = (await request.json()) as HandleUploadBody;

  try {
    const result = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        // clientPayload is a JSON string with { scanId, pose }
        const parsed = JSON.parse(clientPayload ?? '{}') as {
          scanId?: string;
          pose?: 'front' | 'profile';
        };

        if (!parsed.scanId || !parsed.pose) {
          throw new Error('scanId and pose are required');
        }
        if (parsed.pose !== 'front' && parsed.pose !== 'profile') {
          throw new Error('pose must be front or profile');
        }

        // Verify the scan belongs to this user — prevents writing to someone
        // else's scan even if they know its id.
        const rows = (await sql`
          SELECT id FROM scans
          WHERE id = ${parsed.scanId} AND user_id = ${user.id}
          LIMIT 1
        `) as { id: string }[];
        if (rows.length === 0) {
          throw new Error('Scan not found');
        }

        // Enforce a canonical pathname. The client may have submitted a
        // different pathname — we ignore it and use the canonical one so
        // clients can't write to other users' folders.
        const expected = `scans/${user.id}/${parsed.scanId}/${parsed.pose}.jpg`;
        if (pathname !== expected) {
          throw new Error(`pathname must be ${expected}`);
        }

        return {
          allowedContentTypes: ['image/jpeg', 'image/png', 'image/webp'],
          maximumSizeInBytes: 10 * 1024 * 1024, // 10 MB
          addRandomSuffix: false,
          allowOverwrite: true, // permit retakes
          tokenPayload: JSON.stringify({
            userId: user.id,
            scanId: parsed.scanId,
            pose: parsed.pose,
          }),
        };
      },
      // onUploadCompleted fires from a Vercel webhook. We don't rely on it to
      // persist URLs — the client calls /api/scan/[id]/finalize after both
      // images land, which is simpler and more reliable in local dev.
    });

    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Upload failed' },
      { status: 400 },
    );
  }
}
