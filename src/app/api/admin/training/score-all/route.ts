import { NextResponse } from 'next/server';
import { neonAuth } from '@neondatabase/auth/next/server';
import { sql } from '@/lib/db';
import { isAdmin } from '@/lib/admin';
import { runPipelineWithInputs } from '@/lib/pipeline/graph';

// Vercel Pro: scoring N images takes ~15s/image, so 10 images ~ 150s.
export const maxDuration = 300;

type Unscored = {
  id: string;
  front_image_url: string;
  profile_image_url: string;
  gender: 'male' | 'female';
  height_cm: number | null;
  weight_kg: number | null;
};

type ConfigRow = { id: string };

export async function POST() {
  const { user } = await neonAuth();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!(await isAdmin(user.id))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const unscored = (await sql`
    SELECT id, front_image_url, profile_image_url,
           gender, height_cm, weight_kg
    FROM training_scans
    WHERE scan_id IS NULL
    ORDER BY created_at ASC
  `) as Unscored[];

  if (unscored.length === 0) {
    return NextResponse.json({ scored: 0, failed: 0, total: 0 });
  }

  let scored = 0;
  let failed = 0;
  const errors: { id: string; error: string }[] = [];

  for (const t of unscored) {
    try {
      // Resolve the active config for this training row's labeled gender.
      const configs = (await sql`
        SELECT id FROM analysis_configs
        WHERE gender_target = ${t.gender} AND is_active = true
        LIMIT 1
      `) as ConfigRow[];
      if (configs.length === 0) {
        throw new Error(`No active analysis_config for gender=${t.gender}`);
      }
      const configId = configs[0].id;

      const heightCm = t.height_cm != null ? Number(t.height_cm) : 175;
      const weightKg = t.weight_kg != null ? Number(t.weight_kg) : 75;

      // Synthetic scans row owned by the admin so the existing pipeline
      // (which expects a real scans row) can write feature_analyses against it.
      const inserted = (await sql`
        INSERT INTO scans
          (user_id, analysis_config_id, status,
           front_image_url, profile_image_url,
           height_cm_snapshot, weight_kg_snapshot)
        VALUES
          (${user.id}, ${configId}, 'analyzing',
           ${t.front_image_url}, ${t.profile_image_url},
           ${heightCm}, ${weightKg})
        RETURNING id
      `) as { id: string }[];
      const scanId = inserted[0].id;

      await runPipelineWithInputs({
        scanId,
        frontImageUrl: t.front_image_url,
        profileImageUrl: t.profile_image_url,
        gender: t.gender,
        age: 30, // training_scans has no DOB; age is a minor prompt-context detail
        heightCm,
        weightKg,
        configId,
      });

      await sql`
        UPDATE training_scans
        SET scan_id = ${scanId}, scored_at = now()
        WHERE id = ${t.id}
      `;

      scored++;
    } catch (err) {
      failed++;
      errors.push({
        id: t.id,
        error: err instanceof Error ? err.message : 'Unknown error',
      });
    }
  }

  return NextResponse.json({
    total: unscored.length,
    scored,
    failed,
    errors: errors.length > 0 ? errors : undefined,
  });
}
