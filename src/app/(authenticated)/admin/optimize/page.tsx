import { neonAuth } from '@neondatabase/auth/next/server';
import { notFound, redirect } from 'next/navigation';
import { sql } from '@/lib/db';
import { isAdmin } from '@/lib/admin';
import { OptimizePanel } from './optimize-panel';
import { PromoteButton } from './promote-button';
import { WeightComparison } from './weight-comparison';

type RunRow = {
  id: string;
  config_id_produced: string | null;
  gender_target: 'male' | 'female' | null;
  training_scan_count: number;
  baseline_mse: number | null;
  mean_squared_error: number | null;
  mean_absolute_error: number | null;
  iterations: number | null;
  started_at: string;
  completed_at: string | null;
  is_active: boolean;
  final_weights: Record<string, number> | null;
};

type ActiveRow = {
  gender_target: 'male' | 'female';
  feature_name: string;
  weight: number;
};

const fmt = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
});

export default async function OptimizePage() {
  const { user } = await neonAuth();
  if (!user) redirect('/login');
  if (!(await isAdmin(user.id))) notFound();

  const runs = (await sql`
    SELECT r.id,
           r.config_id_produced,
           r.gender_target,
           r.training_scan_count,
           r.baseline_mse::float AS baseline_mse,
           r.mean_squared_error::float AS mean_squared_error,
           r.mean_absolute_error::float AS mean_absolute_error,
           r.iterations,
           r.started_at,
           r.completed_at,
           COALESCE(c.is_active, false) AS is_active,
           r.final_weights
    FROM weight_optimization_runs r
    LEFT JOIN analysis_configs c ON c.id = r.config_id_produced
    ORDER BY r.started_at DESC
    LIMIT 10
  `) as RunRow[];

  const active = (await sql`
    SELECT c.gender_target, fw.feature_name, fw.weight::float AS weight
    FROM analysis_configs c
    JOIN feature_weights fw ON fw.config_id = c.id
    WHERE c.is_active = true AND c.gender_target IN ('male','female')
  `) as ActiveRow[];

  const activeByGender: Record<'male' | 'female', Record<string, number>> = {
    male: {},
    female: {},
  };
  for (const r of active) {
    activeByGender[r.gender_target][r.feature_name] = r.weight;
  }

  const latest = {
    male: runs.find((r) => r.gender_target === 'male' && r.final_weights),
    female: runs.find((r) => r.gender_target === 'female' && r.final_weights),
  };

  return (
    <div className="space-y-8 pb-12">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">
          Weight Optimization
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Coordinate-descent search over the per-region weight vector,
          minimizing MSE against labeled training scans.
        </p>
      </div>

      <OptimizePanel />

      <section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {(['male', 'female'] as const).map((gender) => {
          const run = latest[gender];
          if (!run || !run.final_weights) {
            return (
              <div
                key={gender}
                className="rounded-2xl border border-dashed border-border p-6 text-sm text-muted-foreground"
              >
                <p className="font-semibold capitalize text-foreground">
                  {gender}
                </p>
                <p className="mt-1">No optimizer runs yet.</p>
              </div>
            );
          }
          return (
            <div
              key={gender}
              className="rounded-2xl border border-border bg-card p-5"
            >
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold capitalize text-foreground">
                    {gender} · most recent run
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    {fmt.format(new Date(run.started_at))} ·{' '}
                    {run.training_scan_count} samples · {run.iterations ?? 0}{' '}
                    iters
                  </p>
                </div>
                {run.config_id_produced &&
                  (run.is_active ? (
                    <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-700">
                      Active
                    </span>
                  ) : (
                    <PromoteButton configId={run.config_id_produced} />
                  ))}
              </div>

              <div className="mb-4 grid grid-cols-3 gap-2 text-center text-xs">
                <Stat
                  label="Baseline MSE"
                  value={run.baseline_mse?.toFixed(2) ?? '—'}
                />
                <Stat
                  label="Final MSE"
                  value={run.mean_squared_error?.toFixed(2) ?? '—'}
                  tone={
                    run.baseline_mse != null &&
                    run.mean_squared_error != null &&
                    run.mean_squared_error < run.baseline_mse
                      ? 'positive'
                      : 'neutral'
                  }
                />
                <Stat
                  label="MAE"
                  value={run.mean_absolute_error?.toFixed(2) ?? '—'}
                />
              </div>

              <WeightComparison
                current={activeByGender[gender]}
                candidate={run.final_weights}
              />
            </div>
          );
        })}
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold text-foreground">
          Run history
        </h2>
        <div className="overflow-hidden rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left">Started</th>
                <th className="px-3 py-2 text-left">Gender</th>
                <th className="px-3 py-2 text-right">Samples</th>
                <th className="px-3 py-2 text-right">Iters</th>
                <th className="px-3 py-2 text-right">Baseline MSE</th>
                <th className="px-3 py-2 text-right">Final MSE</th>
                <th className="px-3 py-2 text-right">MAE</th>
                <th className="px-3 py-2 text-left">Status</th>
              </tr>
            </thead>
            <tbody>
              {runs.length === 0 ? (
                <tr>
                  <td
                    colSpan={8}
                    className="px-3 py-6 text-center text-muted-foreground"
                  >
                    No runs yet. Use the panel above to run the optimizer.
                  </td>
                </tr>
              ) : (
                runs.map((r) => (
                  <tr key={r.id} className="border-t border-border">
                    <td className="px-3 py-2">
                      {fmt.format(new Date(r.started_at))}
                    </td>
                    <td className="px-3 py-2 capitalize">
                      {r.gender_target ?? '—'}
                    </td>
                    <td className="px-3 py-2 text-right font-mono">
                      {r.training_scan_count}
                    </td>
                    <td className="px-3 py-2 text-right font-mono">
                      {r.iterations ?? '—'}
                    </td>
                    <td className="px-3 py-2 text-right font-mono">
                      {r.baseline_mse?.toFixed(2) ?? '—'}
                    </td>
                    <td className="px-3 py-2 text-right font-mono">
                      {r.mean_squared_error?.toFixed(2) ?? '—'}
                    </td>
                    <td className="px-3 py-2 text-right font-mono">
                      {r.mean_absolute_error?.toFixed(2) ?? '—'}
                    </td>
                    <td className="px-3 py-2 text-xs">
                      {r.is_active ? (
                        <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 font-semibold text-emerald-700">
                          active
                        </span>
                      ) : (
                        <span className="text-muted-foreground">candidate</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: 'positive' | 'neutral';
}) {
  const cls = tone === 'positive' ? 'text-emerald-600' : 'text-foreground';
  return (
    <div className="rounded-lg border border-border p-2">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p className={`mt-1 text-lg font-bold ${cls}`}>{value}</p>
    </div>
  );
}

