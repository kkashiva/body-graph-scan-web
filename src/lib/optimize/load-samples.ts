import { sql } from '@/lib/db';
import { navyBodyFat } from '@/lib/pipeline/navy';
import type { OptimizerSample, Weights } from './weight-optimizer';

type RegionRow = {
  feature_name: string;
  local_bf_estimate: number;
};

type MeasurementRow = {
  region: string;
  value_cm: number;
};

type TrainingRow = {
  id: string;
  scan_id: string;
  known_bf_pct: number;
  height_cm: number | null;
};

/**
 * Build optimizer samples from already-scored training scans for the given
 * gender. A "scored" training scan is one whose `scan_id` is non-null and
 * whose linked feature_analyses rows are populated.
 */
export async function loadSamples(
  gender: 'male' | 'female',
): Promise<OptimizerSample[]> {
  const trainings = (await sql`
    SELECT id, scan_id, known_bf_pct, height_cm
    FROM training_scans
    WHERE gender = ${gender}
      AND scan_id IS NOT NULL
      AND scored_at IS NOT NULL
  `) as TrainingRow[];

  if (trainings.length === 0) return [];

  const samples: OptimizerSample[] = [];
  for (const t of trainings) {
    const regions = (await sql`
      SELECT feature_name, local_bf_estimate
      FROM feature_analyses
      WHERE scan_id = ${t.scan_id}
    `) as RegionRow[];

    if (regions.length === 0) continue;

    const measurements = (await sql`
      SELECT region, value_cm
      FROM body_measurements
      WHERE scan_id = ${t.scan_id}
    `) as MeasurementRow[];

    const m = new Map(measurements.map((r) => [r.region, Number(r.value_cm)]));
    const navyBf =
      t.height_cm != null
        ? navyBodyFat(
            gender,
            m.get('neck') ?? 0,
            m.get('waist') ?? 0,
            m.get('hips'),
            Number(t.height_cm),
          )
        : null;

    const perRegion: Record<string, number> = {};
    for (const r of regions) {
      perRegion[r.feature_name] = Number(r.local_bf_estimate);
    }

    samples.push({
      perRegion,
      navyBf: navyBf !== null && navyBf > 0 && navyBf < 60 ? navyBf : null,
      knownBf: Number(t.known_bf_pct),
    });
  }

  return samples;
}

/**
 * Load the currently-active feature_weights vector for the given gender.
 * Returns the map keyed by feature_name → weight.
 */
export async function loadActiveWeights(
  gender: 'male' | 'female',
): Promise<{ configId: string; weights: Weights }> {
  const rows = (await sql`
    SELECT c.id AS config_id, fw.feature_name, fw.weight
    FROM analysis_configs c
    JOIN feature_weights fw ON fw.config_id = c.id
    WHERE c.gender_target = ${gender} AND c.is_active = true
  `) as { config_id: string; feature_name: string; weight: number }[];

  if (rows.length === 0) {
    throw new Error(`No active analysis_config for gender=${gender}`);
  }

  const weights: Weights = {};
  for (const r of rows) weights[r.feature_name] = Number(r.weight);

  return { configId: rows[0].config_id, weights };
}
