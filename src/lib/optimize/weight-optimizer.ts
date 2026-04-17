/**
 * Pure-function coordinate-descent optimizer over the per-region weight
 * vector used by `aggregate.ts`. No DB access — easy to unit-test and to
 * call from a CLI script.
 *
 * Mirrors the production loss exactly: the predicted body-fat for a sample
 * is the same 50/50 blend of weighted-visual and Navy-formula that
 * `src/lib/pipeline/aggregate.ts` produces, clamped to [3, 55].
 */

export type OptimizerSample = {
  /** featureName -> local_bf_estimate from feature_analyses */
  perRegion: Record<string, number>;
  /** Recomputed Navy-formula estimate (null if circumferences invalid) */
  navyBf: number | null;
  /** Ground truth */
  knownBf: number;
};

export type Weights = Record<string, number>;

export type OptimizerOptions = {
  /** Hard ceiling on outer iterations. Default 200. */
  maxIter?: number;
  /** Initial transfer step in weight space. Default 0.02. */
  step?: number;
  /** Stop when step shrinks below this. Default 0.001. */
  minStep?: number;
};

export type OptimizerResult = {
  weights: Weights;
  mse: number;
  mae: number;
  iterations: number;
  baselineMse: number;
  baselineMae: number;
};

const CLAMP_MIN = 3;
const CLAMP_MAX = 55;

function clamp(x: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, x));
}

function normalize(w: Weights): Weights {
  const sum = Object.values(w).reduce((s, v) => s + v, 0);
  if (sum <= 0) {
    const keys = Object.keys(w);
    const even = 1 / keys.length;
    return Object.fromEntries(keys.map((k) => [k, even]));
  }
  return Object.fromEntries(Object.entries(w).map(([k, v]) => [k, v / sum]));
}

/**
 * Predict body-fat for a sample given a weight vector. Matches
 * aggregate.ts:80–96 exactly.
 */
export function predict(sample: OptimizerSample, weights: Weights): number {
  let weightedSum = 0;
  let weightTotal = 0;
  for (const [region, w] of Object.entries(weights)) {
    const x = sample.perRegion[region];
    if (typeof x === 'number' && w > 0) {
      weightedSum += x * w;
      weightTotal += w;
    }
  }
  const visual = weightTotal > 0 ? weightedSum / weightTotal : null;
  const navy = sample.navyBf;
  const navyValid = navy !== null && navy > 0 && navy < 60;

  let pred: number;
  if (visual !== null && navyValid) pred = 0.5 * visual + 0.5 * (navy as number);
  else if (visual !== null) pred = visual;
  else if (navyValid) pred = navy as number;
  else pred = 20; // matches aggregate.ts fallback

  return clamp(pred, CLAMP_MIN, CLAMP_MAX);
}

function computeLosses(
  samples: OptimizerSample[],
  weights: Weights,
): { mse: number; mae: number } {
  let sse = 0;
  let sae = 0;
  for (const s of samples) {
    const err = predict(s, weights) - s.knownBf;
    sse += err * err;
    sae += Math.abs(err);
  }
  const n = samples.length || 1;
  return { mse: sse / n, mae: sae / n };
}

/**
 * Coordinate descent on pairs of regions. Each outer iteration tries every
 * (donor, recipient) pair, transferring `step` from the donor's weight to
 * the recipient's weight, and keeps the single best improving move. When
 * no pair improves MSE, the step size is halved.
 *
 * The transfer-based moves preserve the sum-to-1 constraint for free, so
 * we never have to renormalize mid-loop.
 */
export function optimizeWeights(
  samples: OptimizerSample[],
  initial: Weights,
  opts: OptimizerOptions = {},
): OptimizerResult {
  const maxIter = opts.maxIter ?? 200;
  const minStep = opts.minStep ?? 0.001;
  let step = opts.step ?? 0.02;

  const weights = normalize(initial);
  const baseline = computeLosses(samples, weights);

  if (samples.length === 0) {
    return {
      weights,
      mse: baseline.mse,
      mae: baseline.mae,
      iterations: 0,
      baselineMse: baseline.mse,
      baselineMae: baseline.mae,
    };
  }

  const regions = Object.keys(weights);
  let currentMse = baseline.mse;
  let iterations = 0;

  while (iterations < maxIter && step >= minStep) {
    let bestMse = currentMse;
    let bestMove: { from: string; to: string } | null = null;

    for (const from of regions) {
      if (weights[from] < step) continue; // can't donate more than we have
      for (const to of regions) {
        if (from === to) continue;
        if (weights[to] + step > 1) continue;

        weights[from] -= step;
        weights[to] += step;
        const { mse } = computeLosses(samples, weights);
        if (mse < bestMse - 1e-9) {
          bestMse = mse;
          bestMove = { from, to };
        }
        weights[from] += step;
        weights[to] -= step;
      }
    }

    if (bestMove) {
      weights[bestMove.from] -= step;
      weights[bestMove.to] += step;
      currentMse = bestMse;
      iterations++;
    } else {
      step /= 2;
    }
  }

  const final = computeLosses(samples, weights);
  return {
    weights,
    mse: final.mse,
    mae: final.mae,
    iterations,
    baselineMse: baseline.mse,
    baselineMae: baseline.mae,
  };
}
