import { NextResponse } from 'next/server';
import { handleUpload, type HandleUploadBody } from '@vercel/blob/client';
import { neonAuth } from '@neondatabase/auth/next/server';
import { isAdmin } from '@/lib/admin';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(request: Request) {
  const { user } = await neonAuth();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!(await isAdmin(user.id))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = (await request.json()) as HandleUploadBody;

  try {
    const result = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        const parsed = JSON.parse(clientPayload ?? '{}') as {
          tempId?: string;
          pose?: 'front' | 'profile';
        };

        if (!parsed.tempId || !UUID_RE.test(parsed.tempId)) {
          throw new Error('valid tempId (uuid) is required');
        }
        if (parsed.pose !== 'front' && parsed.pose !== 'profile') {
          throw new Error('pose must be front or profile');
        }

        const expected = `training/${parsed.tempId}/${parsed.pose}.jpg`;
        if (pathname !== expected) {
          throw new Error(`pathname must be ${expected}`);
        }

        return {
          allowedContentTypes: ['image/jpeg', 'image/png', 'image/webp'],
          maximumSizeInBytes: 10 * 1024 * 1024,
          addRandomSuffix: false,
          allowOverwrite: true,
          tokenPayload: JSON.stringify({
            userId: user.id,
            tempId: parsed.tempId,
            pose: parsed.pose,
          }),
        };
      },
    });

    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Upload failed' },
      { status: 400 },
    );
  }
}
