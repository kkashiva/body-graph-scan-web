import { neonAuth } from '@neondatabase/auth/next/server';
import { redirect } from 'next/navigation';
import { sql } from '@/lib/db';
import { ScanPolling } from './scan-polling';

type ScanRow = {
  id: string;
  status: string;
  front_image_url: string | null;
  profile_image_url: string | null;
  error_message: string | null;
  created_at: string;
  completed_at: string | null;
  height_cm_snapshot: number | null;
  weight_kg_snapshot: number | null;
};

const HEADLINE_REGIONS = ['neck', 'waist', 'hips', 'chest'] as const;
type HeadlineRegion = (typeof HEADLINE_REGIONS)[number];

type ResultRow = {
  body_fat_pct: number;
  bmi: number;
  method: string;
  confidence_score: number;
  notes: string;
};

type AnalysisRow = {
  feature_name: string;
  local_bf_estimate: number;
  confidence: number;
  weight_applied: number;
  model_used: string;
  latency_ms: number;
  raw_llm_response: { explanation?: string };
};

type MeasurementRow = {
  region: string;
  value_cm: number;
  confidence: number;
  is_primary: boolean;
};

export default async function ScanDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { user } = await neonAuth();
  if (!user) redirect('/login');

  const { id } = await params;

  const scans = (await sql`
    SELECT id, status, front_image_url, profile_image_url,
           error_message, created_at, completed_at,
           height_cm_snapshot::float AS height_cm_snapshot,
           weight_kg_snapshot::float AS weight_kg_snapshot
    FROM scans
    WHERE id = ${id} AND user_id = ${user.id}
  `) as ScanRow[];

  if (scans.length === 0) {
    return (
      <div className="text-center py-20">
        <h1 className="text-2xl font-bold text-foreground">Scan not found</h1>
        <p className="mt-2 text-muted-foreground">
          This scan doesn&apos;t exist or you don&apos;t have access.
        </p>
      </div>
    );
  }

  const scan = scans[0];

  // --- Analyzing state: show spinner + poll ---
  if (scan.status === 'analyzing' || scan.status === 'uploading') {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        <h1 className="mt-6 text-2xl font-bold text-foreground">
          Analyzing your scan...
        </h1>
        <p className="mt-2 max-w-md text-muted-foreground">
          Our AI is examining 8 body regions in parallel. This typically takes
          15–30 seconds.
        </p>
        <ScanPolling scanId={id} />
      </div>
    );
  }

  // --- Failed state ---
  if (scan.status === 'failed') {
    return (
      <div className="py-12">
        <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-8 text-center">
          <h1 className="text-2xl font-bold text-destructive">Analysis Failed</h1>
          <p className="mt-3 text-muted-foreground">
            {scan.error_message || 'An unexpected error occurred during analysis.'}
          </p>
        </div>
      </div>
    );
  }

  // --- Completed state: show results ---
  const results = (await sql`
    SELECT body_fat_pct, bmi, method, confidence_score, notes
    FROM scan_results WHERE scan_id = ${id}
  `) as ResultRow[];

  const analyses = (await sql`
    SELECT feature_name, local_bf_estimate, confidence,
           weight_applied, model_used, latency_ms, raw_llm_response
    FROM feature_analyses WHERE scan_id = ${id}
    ORDER BY weight_applied DESC
  `) as AnalysisRow[];

  const measurements = (await sql`
    SELECT region, value_cm, confidence, is_primary
    FROM body_measurements WHERE scan_id = ${id}
    ORDER BY is_primary DESC, region
  `) as MeasurementRow[];

  const result = results[0];

  const measurementsByRegion = new Map(measurements.map((m) => [m.region, m]));
  const headlineMeasurements = HEADLINE_REGIONS.map(
    (r) => measurementsByRegion.get(r) ?? null,
  );
  const headlineSet = new Set<string>(HEADLINE_REGIONS as readonly string[]);
  const otherMeasurements = measurements.filter((m) => !headlineSet.has(m.region));

  return (
    <div className="space-y-8 pb-12">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          Scan Results
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {new Date(scan.created_at).toLocaleDateString('en-US', {
            year: 'numeric', month: 'long', day: 'numeric',
            hour: '2-digit', minute: '2-digit',
          })}
        </p>
      </div>

      {/* Primary metrics */}
      {result && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <MetricCard
            label="Body Fat"
            value={`${result.body_fat_pct}%`}
            sub={bfCategory(result.body_fat_pct)}
          />
          <MetricCard
            label="BMI"
            value={String(result.bmi)}
            sub={bmiCategory(result.bmi)}
          />
          <MetricCard
            label="Confidence"
            value={`${Math.round(result.confidence_score * 100)}%`}
            sub={result.method.replace(/_/g, ' ')}
          />
          <MetricCard
            label="Regions"
            value={`${analyses.length}`}
            sub="analyzed"
          />
        </div>
      )}

      {/* Measurements hero — the numbers judges care most about */}
      {(measurements.length > 0 ||
        scan.height_cm_snapshot !== null ||
        scan.weight_kg_snapshot !== null) && (
        <section>
          <div className="mb-4 flex items-baseline justify-between">
            <h2 className="text-lg font-semibold text-foreground">
              Your Measurements
            </h2>
            {headlineMeasurements.some((m) => m && m.is_primary) && (
              <span className="text-xs text-muted-foreground">
                <span className="text-primary">Navy</span> = used in Navy BF% formula
              </span>
            )}
          </div>

          {(scan.height_cm_snapshot !== null ||
            scan.weight_kg_snapshot !== null) && (
            <div className="mb-4 flex flex-wrap gap-x-6 gap-y-2 rounded-xl border border-border bg-card px-4 py-3 text-sm">
              <span className="text-muted-foreground">
                <span className="font-medium text-foreground">Inputs:</span>
              </span>
              {scan.height_cm_snapshot !== null && (
                <span className="text-muted-foreground">
                  Height{' '}
                  <span className="font-semibold text-foreground">
                    {scan.height_cm_snapshot} cm
                  </span>
                </span>
              )}
              {scan.weight_kg_snapshot !== null && (
                <span className="text-muted-foreground">
                  Weight{' '}
                  <span className="font-semibold text-foreground">
                    {scan.weight_kg_snapshot} kg
                  </span>
                </span>
              )}
            </div>
          )}

          {headlineMeasurements.some(Boolean) && (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              {HEADLINE_REGIONS.map((region, i) => {
                const m = headlineMeasurements[i];
                return (
                  <div
                    key={region}
                    className="rounded-2xl border border-border bg-card p-5 text-center shadow-sm"
                  >
                    <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      {region}
                      {m?.is_primary && (
                        <span className="ml-1.5 text-primary">Navy</span>
                      )}
                    </p>
                    <p className="mt-2 text-3xl font-bold text-foreground">
                      {m ? `${m.value_cm}` : '—'}
                      {m && (
                        <span className="ml-1 text-base font-medium text-muted-foreground">
                          cm
                        </span>
                      )}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {m
                        ? `${Math.round(m.confidence * 100)}% confidence`
                        : 'not detected'}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* Secondary measurements — biceps, thighs, calves, etc. */}
      {otherMeasurements.length > 0 && (
        <section>
          <h2 className="mb-4 text-lg font-semibold text-foreground">
            Other Measurements
          </h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {otherMeasurements.map((m) => (
              <div
                key={m.region}
                className="rounded-xl border border-border bg-card p-4"
              >
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  {m.region.replace(/_/g, ' ')}
                </p>
                <p className="mt-1 text-xl font-bold text-foreground">
                  {m.value_cm} cm
                </p>
                <p className="text-xs text-muted-foreground">
                  {Math.round(m.confidence * 100)}% confidence
                </p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Per-region breakdown */}
      {analyses.length > 0 && (
        <section>
          <h2 className="mb-4 text-lg font-semibold text-foreground">
            Region Breakdown
          </h2>
          <div className="space-y-3">
            {analyses.map((a) => (
              <div
                key={a.feature_name}
                className="rounded-xl border border-border bg-card p-4"
              >
                <div className="flex items-baseline justify-between">
                  <h3 className="font-semibold capitalize text-foreground">
                    {a.feature_name}
                  </h3>
                  <span className="text-lg font-bold text-primary">
                    {a.local_bf_estimate}%
                  </span>
                </div>
                <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary transition-all"
                    style={{ width: `${Math.min(100, (a.local_bf_estimate / 40) * 100)}%` }}
                  />
                </div>
                <p className="mt-2 text-sm text-muted-foreground">
                  {a.raw_llm_response?.explanation || ''}
                </p>
                <div className="mt-2 flex gap-4 text-xs text-muted-foreground">
                  <span>Weight: {(a.weight_applied * 100).toFixed(0)}%</span>
                  <span>Confidence: {Math.round(a.confidence * 100)}%</span>
                  <span>{a.model_used}</span>
                  <span>{a.latency_ms}ms</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Notes */}
      {result?.notes && (
        <section className="rounded-xl border border-border bg-card p-4">
          <h2 className="text-sm font-semibold text-muted-foreground">Notes</h2>
          <p className="mt-1 text-sm text-foreground">{result.notes}</p>
        </section>
      )}
    </div>
  );
}

function MetricCard({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 text-center shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p className="mt-2 text-3xl font-bold text-foreground">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{sub}</p>
    </div>
  );
}

function bfCategory(pct: number): string {
  if (pct < 6) return 'Essential';
  if (pct < 14) return 'Athletic';
  if (pct < 18) return 'Fitness';
  if (pct < 25) return 'Average';
  return 'Above average';
}

function bmiCategory(bmi: number): string {
  if (bmi < 18.5) return 'Underweight';
  if (bmi < 25) return 'Normal';
  if (bmi < 30) return 'Overweight';
  return 'Obese';
}
