import sharp from 'sharp';
import { REGIONS } from './regions';
import type { CroppedRegion, GraphStateType } from './state';

// Silhouette viewBox dimensions (matches the 9:16 capture overlay).
const VIEWBOX_W = 100;
const VIEWBOX_H = 177;

async function fetchImageBuffer(url: string): Promise<Buffer> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch image: ${res.status} ${url}`);
  return Buffer.from(await res.arrayBuffer());
}

/**
 * Cropper node — downloads images and crops each body region.
 */
export async function cropImages(
  state: GraphStateType,
): Promise<Partial<GraphStateType>> {
  // Download both images in parallel
  const [frontBuf, profileBuf] = await Promise.all([
    fetchImageBuffer(state.frontImageUrl),
    fetchImageBuffer(state.profileImageUrl),
  ]);

  const frontMeta = await sharp(frontBuf).metadata();
  const profileMeta = await sharp(profileBuf).metadata();

  const buffers: Record<string, { buf: Buffer; w: number; h: number }> = {
    front: {
      buf: frontBuf,
      w: frontMeta.width ?? 1080,
      h: frontMeta.height ?? 1920,
    },
    profile: {
      buf: profileBuf,
      w: profileMeta.width ?? 1080,
      h: profileMeta.height ?? 1920,
    },
  };

  const croppedRegions: CroppedRegion[] = [];

  for (const region of REGIONS) {
    const img = buffers[region.imageType];
    const scaleX = img.w / VIEWBOX_W;
    const scaleY = img.h / VIEWBOX_H;

    const left = Math.max(0, Math.round(region.box.x * scaleX));
    const top = Math.max(0, Math.round(region.box.y * scaleY));
    const width = Math.min(
      Math.round(region.box.w * scaleX),
      img.w - left,
    );
    const height = Math.min(
      Math.round(region.box.h * scaleY),
      img.h - top,
    );

    const cropped = await sharp(img.buf)
      .extract({ left, top, width, height })
      .jpeg({ quality: 85 })
      .toBuffer();

    croppedRegions.push({
      regionName: region.name,
      imageBase64: cropped.toString('base64'),
      imageType: region.imageType,
      boundingBox: { x: left, y: top, width, height },
    });
  }

  return { croppedRegions };
}
