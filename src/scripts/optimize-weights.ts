/**
 * Headless weight optimizer.
 *
 *   npm run optimize:weights -- --gender male
 *   npm run optimize:weights -- --gender female --persist
 *
 * Loads scored training samples for the gender, runs coordinate descent,
 * prints a side-by-side weight comparison + MSE/MAE before/after, and
 * (optionally) writes the candidate as a new inactive analysis_config.
 */

import { loadEnvConfig } from '@next/env';
loadEnvConfig(process.cwd());

import { neon } from '@neondatabase/serverless';
import { navyBodyFat } from '../lib/pipeline/navy';
import {
  optimizeWeights,
  type OptimizerSample,
  type Weights,
} from '../lib/optimize/weight-optimizer';

function parseArgs(): { gender: 'male' | 'female'; persist: boolean } {
  const args = process.argv.slice(2);
  let gender: 'male' | 'female' = 'male';
  let persist = false;
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--gender' || a === '-g') {
      const v = args[++i];
      if (v !== 'male' && v !== 'female') {
        console.error(`Invalid --gender: ${v}`);
        process.exit(1);
      }
      gender = v;
    } else if (a === '--persist') {
      persist = true;
    }
  }
  return { gender, persist };
}

async function main() {
  const { gender, persist } = parseArgs();
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('DATABASE_URL is required');
    process.exit(1);
  }
  const sql = neon(databaseUrl);

  // Load active weights inline (cannot import @/lib/optimize/load-samples
  // because tsx CLI doesn't resolve the @/ alias the way Next does).
  const activeRows = (await sql`
    SELECT c.id AS config_id, fw.feature_name, fw.weight::float AS weight
    FROM analysis_configs c
    JOIN feature_weights fw ON fw.config_id = c.id
    WHERE c.gender_target = ${gender} AND c.is_active = true
  `) as { config_id: string; feature_name: string; weight: number }[];

  if (activeRows.length === 0) {
    console.error(`No active analysis_config for gender=${gender}`);
    process.exit(1);
  }
  const initial: Weights = {};
  for (const r of activeRows) initial[r.feature_name] = Number(r.weight);

  // Load samples
  const trainings = (await sql`
    SELECT id, scan_id, known_bf_pct::float AS known_bf_pct,
           height_cm::float AS height_cm
    FROM training_scans
    WHERE gender = ${gender}
      AND scan_id IS NOT NULL
      AND scored_at IS NOT NULL
  `) as {
    id: string;
    scan_id: string;
    known_bf_pct: number;
    height_cm: number | null;
  }[];

  const samples: OptimizerSample[] = [];
  for (const t of trainings) {
    const regions = (await sql`
      SELECT feature_name, local_bf_estimate::float AS local_bf_estimate
      FROM feature_analyses WHERE scan_id = ${t.scan_id}
    `) as { feature_name: string; local_bf_estimate: number }[];
    if (regions.length === 0) continue;

    const measurements = (await sql`
      SELECT region, value_cm::float AS value_cm
      FROM body_measurements WHERE scan_id = ${t.scan_id}
    `) as { region: string; value_cm: number }[];
    const m = new Map(measurements.map((r) => [r.region, r.value_cm]));

    const navy =
      t.height_cm != null
        ? navyBodyFat(
            gender,
            m.get('neck') ?? 0,
            m.get('waist') ?? 0,
            m.get('hips'),
            t.height_cm,
          )
        : null;

    const perRegion: Record<string, number> = {};
    for (const r of regions) perRegion[r.feature_name] = r.local_bf_estimate;

    samples.push({
      perRegion,
      navyBf: navy !== null && navy > 0 && navy < 60 ? navy : null,
      knownBf: t.known_bf_pct,
    });
  }

  console.log(`Loaded ${samples.length} samples for gender=${gender}`);
  if (samples.length === 0) {
    console.error('Nothing to optimize.');
    process.exit(1);
  }

  console.log('Running coordinate descent…');
  const result = optimizeWeights(samples, initial);

  console.log('');
  console.log(
    `MSE: ${result.baselineMse.toFixed(3)} → ${result.mse.toFixed(3)}`,
  );
  console.log(`MAE: ${result.baselineMae.toFixed(3)} → ${result.mae.toFixed(3)}`);
  console.log(`Iterations: ${result.iterations}`);
  console.log('');
  console.log('Region        Active   →   Candidate');
  console.log('────────────────────────────────────');
  const all = Array.from(
    new Set([...Object.keys(initial), ...Object.keys(result.weights)]),
  ).sort((a, b) => (result.weights[b] ?? 0) - (result.weights[a] ?? 0));
  for (const r of all) {
    const a = (initial[r] ?? 0).toFixed(3);
    const c = (result.weights[r] ?? 0).toFixed(3);
    console.log(`${r.padEnd(13)} ${a}      ${c}`);
  }

  if (!persist) {
    console.log('\n(use --persist to save as a new analysis_config)');
    return;
  }

  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const inserted = (await sql`
    INSERT INTO analysis_configs (name, description, gender_target, is_active)
    VALUES (
      ${`optimized-${gender}-${ts}`},
      ${`CLI-optimized over ${samples.length} samples`},
      ${gender},
      false
    )
    RETURNING id
  `) as { id: string }[];
  const newConfigId = inserted[0].id;

  for (const [feature, weight] of Object.entries(result.weights)) {
    const w = Math.max(0, Math.min(1, Math.round(weight * 1000) / 1000));
    await sql`
      INSERT INTO feature_weights (config_id, feature_name, weight)
      VALUES (${newConfigId}, ${feature}, ${w})
    `;
  }

  await sql`
    INSERT INTO weight_optimization_runs
      (config_id_produced, training_scan_count,
       mean_absolute_error, mean_squared_error,
       gender_target, baseline_mse, final_weights, iterations,
       completed_at, notes)
    VALUES
      (${newConfigId}, ${samples.length},
       ${result.mae.toFixed(2)}, ${result.mse.toFixed(4)},
       ${gender}, ${result.baselineMse.toFixed(4)},
       ${JSON.stringify(result.weights)}, ${result.iterations},
       now(), 'CLI run')
  `;

  console.log(`\nPersisted as analysis_configs.id = ${newConfigId} (inactive).`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
