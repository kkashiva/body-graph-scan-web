import { sql } from '@/lib/db';
import { REGIONS } from './regions';
import type { AnalysisResult, FinalResult, GraphStateType } from './state';

type FeatureWeight = { feature_name: string; weight: number; id: string };

/**
 * US Navy body-fat formula.
 */
function navyBodyFat(
  gender: string,
  neckCm: number,
  waistCm: number,
  hipCm: number | undefined,
  heightCm: number,
): number | null {
  if (gender === 'male') {
    if (waistCm <= neckCm) return null;
    return (
      86.01 * Math.log10(waistCm - neckCm) -
      70.041 * Math.log10(heightCm) +
      36.76
    );
  }
  if (gender === 'female') {
    if (!hipCm || waistCm + hipCm <= neckCm) return null;
    return (
      163.205 * Math.log10(waistCm + hipCm - neckCm) -
      97.684 * Math.log10(heightCm) +
      78.387
    );
  }
  return null;
}

/**
 * Aggregator node — computes final BF%, writes all results to DB.
 */
export async function aggregate(
  state: GraphStateType,
): Promise<Partial<GraphStateType>> {
  const { scanId, configId, gender, heightCm, weightKg, analyses } = state;

  // Load feature weights from DB
  const weights = (await sql`
    SELECT id, feature_name, weight FROM feature_weights
    WHERE config_id = ${configId}
  `) as FeatureWeight[];

  const weightMap = new Map(weights.map((w) => [w.feature_name, w]));

  // ---- Weighted average BF% ----
  let weightedSum = 0;
  let weightTotal = 0;

  for (const a of analyses) {
    const fw = weightMap.get(a.featureName);
    const w = fw ? Number(fw.weight) : 0;
    if (w > 0) {
      weightedSum += a.localBfEstimate * w;
      weightTotal += w;
    }
  }

  const weightedBf = weightTotal > 0 ? weightedSum / weightTotal : null;

  // ---- Navy formula ----
  const neckResult = analyses.find((a) => a.featureName === 'neck');
  const waistResult = analyses.find((a) => a.featureName === 'waist');
  const hipsResult = analyses.find((a) => a.featureName === 'hips');

  const navyBf = navyBodyFat(
    gender,
    neckResult?.circumferenceCm ?? 0,
    waistResult?.circumferenceCm ?? 0,
    hipsResult?.circumferenceCm,
    heightCm,
  );

  // ---- Final BF% ----
  let finalBf: number;
  let method: string;

  if (weightedBf !== null && navyBf !== null && navyBf > 0 && navyBf < 60) {
    finalBf = weightedBf * 0.5 + navyBf * 0.5;
    method = 'weighted_avg + navy_formula';
  } else if (weightedBf !== null) {
    finalBf = weightedBf;
    method = 'weighted_avg_only';
  } else {
    finalBf = 20; // fallback
    method = 'fallback';
  }

  // Clamp to reasonable range
  finalBf = Math.max(3, Math.min(55, finalBf));

  // ---- BMI ----
  const heightM = heightCm / 100;
  const bmi = weightKg / (heightM * heightM);

  // ---- Confidence ----
  const avgConfidence =
    analyses.reduce((sum, a) => sum + a.confidence, 0) / analyses.length;
  const navyAvailable = navyBf !== null && navyBf > 0 && navyBf < 60;
  const confidenceScore = Math.min(
    0.99,
    navyAvailable ? avgConfidence : avgConfidence * 0.8,
  );

  // ---- Notes ----
  const parts: string[] = [];
  if (navyBf !== null && navyBf > 0 && navyBf < 60)
    parts.push(`Navy formula: ${navyBf.toFixed(1)}%`);
  if (weightedBf !== null)
    parts.push(`Weighted visual: ${weightedBf.toFixed(1)}%`);
  parts.push(`${analyses.length}/${REGIONS.length} regions analyzed`);
  const notes = parts.join('. ');

  // ---- Write feature_analyses rows ----
  for (const a of analyses) {
    const fw = weightMap.get(a.featureName);
    const regionDef = REGIONS.find((r) => r.name === a.featureName);
    await sql`
      INSERT INTO feature_analyses
        (scan_id, feature_weight_id, feature_name, image_type,
         local_bf_estimate, confidence, weight_applied,
         raw_llm_response, model_used, latency_ms)
      VALUES
        (${scanId}, ${fw?.id ?? null}, ${a.featureName}, ${regionDef?.imageType ?? 'front'},
         ${a.localBfEstimate}, ${a.confidence}, ${fw ? Number(fw.weight) : 0},
         ${JSON.stringify(a.rawResponse)}, ${a.modelUsed}, ${a.latencyMs})
      ON CONFLICT (scan_id, feature_name, image_type) DO UPDATE SET
        local_bf_estimate = EXCLUDED.local_bf_estimate,
        confidence = EXCLUDED.confidence,
        raw_llm_response = EXCLUDED.raw_llm_response,
        model_used = EXCLUDED.model_used,
        latency_ms = EXCLUDED.latency_ms
    `;
  }

  // ---- Write body_measurements rows ----
  for (const a of analyses) {
    if (a.circumferenceCm == null) continue;
    const regionDef = REGIONS.find((r) => r.name === a.featureName);
    if (!regionDef?.measurementRegion) continue;
    const isPrimary = ['neck', 'waist', 'hips'].includes(regionDef.measurementRegion);
    await sql`
      INSERT INTO body_measurements
        (scan_id, region, value_cm, confidence, is_primary)
      VALUES
        (${scanId}, ${regionDef.measurementRegion}, ${a.circumferenceCm},
         ${a.confidence}, ${isPrimary})
      ON CONFLICT (scan_id, region) DO UPDATE SET
        value_cm = EXCLUDED.value_cm,
        confidence = EXCLUDED.confidence
    `;
  }

  // ---- Write scan_results row ----
  await sql`
    INSERT INTO scan_results
      (scan_id, body_fat_pct, bmi, method, confidence_score, notes)
    VALUES
      (${scanId}, ${Math.round(finalBf * 10) / 10}, ${Math.round(bmi * 10) / 10},
       ${method}, ${Math.round(confidenceScore * 100) / 100}, ${notes})
    ON CONFLICT (scan_id) DO UPDATE SET
      body_fat_pct = EXCLUDED.body_fat_pct,
      bmi = EXCLUDED.bmi,
      method = EXCLUDED.method,
      confidence_score = EXCLUDED.confidence_score,
      notes = EXCLUDED.notes
  `;

  // ---- Update scan status ----
  await sql`
    UPDATE scans
    SET status = 'completed', completed_at = now()
    WHERE id = ${scanId}
  `;

  const result: FinalResult = {
    bodyFatPct: Math.round(finalBf * 10) / 10,
    bmi: Math.round(bmi * 10) / 10,
    method,
    confidenceScore: Math.round(confidenceScore * 100) / 100,
    notes,
  };

  return { result };
}
