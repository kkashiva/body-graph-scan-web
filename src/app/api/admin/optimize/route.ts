import { NextResponse } from 'next/server';
import { neonAuth } from '@neondatabase/auth/next/server';
import { sql } from '@/lib/db';
import { isAdmin } from '@/lib/admin';
import { loadActiveWeights, loadSamples } from '@/lib/optimize/load-samples';
import { optimizeWeights } from '@/lib/optimize/weight-optimizer';

type Body = { gender?: 'male' | 'female' };

export async function POST(request: Request) {
  const { user } = await neonAuth();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!(await isAdmin(user.id))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = (await request.json().catch(() => ({}))) as Body;
  if (body.gender !== 'male' && body.gender !== 'female') {
    return NextResponse.json({ error: 'gender must be male or female' }, { status: 400 });
  }
  const gender = body.gender;

  const samples = await loadSamples(gender);
  if (samples.length === 0) {
    return NextResponse.json(
      { error: `No scored training samples for gender=${gender}` },
      { status: 400 },
    );
  }

  const { weights: initial } = await loadActiveWeights(gender);
  const result = optimizeWeights(samples, initial);

  // Persist as a new (inactive) analysis_config + feature_weights.
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const configName = `optimized-${gender}-${ts}`;

  const inserted = (await sql`
    INSERT INTO analysis_configs (name, description, gender_target, is_active)
    VALUES (
      ${configName},
      ${`Optimized over ${samples.length} samples (MSE ${result.baselineMse.toFixed(2)} → ${result.mse.toFixed(2)})`},
      ${gender},
      false
    )
    RETURNING id
  `) as { id: string }[];
  const newConfigId = inserted[0].id;

  for (const [feature, weight] of Object.entries(result.weights)) {
    // Round to 3 decimals to fit NUMERIC(4,3) and the [0,1] check.
    const w = Math.max(0, Math.min(1, Math.round(weight * 1000) / 1000));
    await sql`
      INSERT INTO feature_weights (config_id, feature_name, weight)
      VALUES (${newConfigId}, ${feature}, ${w})
    `;
  }

  const runRows = (await sql`
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
       now(), ${`Coordinate descent, ${result.iterations} accepted moves`})
    RETURNING id
  `) as { id: string }[];

  return NextResponse.json({
    runId: runRows[0].id,
    configId: newConfigId,
    sampleCount: samples.length,
    baselineMse: result.baselineMse,
    finalMse: result.mse,
    mae: result.mae,
    iterations: result.iterations,
    weights: result.weights,
  });
}
