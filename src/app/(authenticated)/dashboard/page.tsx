import { neonAuth } from '@neondatabase/auth/next/server';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { sql } from '@/lib/db';
import { BodyFatTrend, type TrendPoint } from './body-fat-trend';

type TrendRow = TrendPoint & { id: string };

const cardDate = new Intl.DateTimeFormat('en-US', {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
});

export default async function DashboardPage() {
  const { user } = await neonAuth();
  if (!user) redirect('/login');

  const rows = (await sql`
    SELECT s.id,
           s.completed_at,
           r.body_fat_pct::float AS body_fat_pct,
           r.bmi::float AS bmi,
           r.confidence_score::float AS confidence_score
    FROM scans s
    JOIN scan_results r ON r.scan_id = s.id
    WHERE s.user_id = ${user.id}
      AND s.status = 'completed'
      AND r.body_fat_pct IS NOT NULL
    ORDER BY s.completed_at ASC
  `) as TrendRow[];

  if (rows.length === 0) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">
          Your Scans
        </h1>
        <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center">
          <p className="text-lg font-medium text-foreground">
            No completed scans yet
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            Run your first scan to start tracking your body composition over
            time.
          </p>
          <Link
            href="/scan/new"
            className="mt-6 inline-flex rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:opacity-90"
          >
            Start your first scan
          </Link>
        </div>
      </div>
    );
  }

  const latest = rows[rows.length - 1];
  const previous = rows.length > 1 ? rows[rows.length - 2] : null;
  const delta = previous ? latest.body_fat_pct - previous.body_fat_pct : null;

  const recent = [...rows].reverse().slice(0, 10);

  return (
    <div className="space-y-8 pb-12">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">
          Your Scans
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Body fat trend across {rows.length}{' '}
          {rows.length === 1 ? 'scan' : 'scans'}.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <MetricCard
          label="Latest BF%"
          value={`${latest.body_fat_pct}%`}
          sub={cardDate.format(new Date(latest.completed_at))}
        />
        <MetricCard
          label="Change"
          value={formatDelta(delta)}
          sub={delta === null ? 'first scan' : 'vs. previous'}
          tone={deltaTone(delta)}
        />
        <MetricCard
          label="Latest BMI"
          value={String(latest.bmi)}
          sub={cardDate.format(new Date(latest.completed_at))}
        />
        <MetricCard
          label="Total Scans"
          value={String(rows.length)}
          sub="completed"
        />
      </div>

      <section>
        <h2 className="mb-3 text-lg font-semibold text-foreground">
          Body Fat % Over Time
        </h2>
        <BodyFatTrend data={rows} />
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold text-foreground">
          Recent Scans
        </h2>
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {recent.map((r) => (
            <li key={r.id}>
              <Link
                href={`/scan/${r.id}`}
                className="flex items-center justify-between rounded-xl border border-border bg-card p-4 transition-colors hover:border-primary/50"
              >
                <div>
                  <p className="text-sm font-medium text-foreground">
                    {cardDate.format(new Date(r.completed_at))}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    BMI {r.bmi} · {Math.round(r.confidence_score * 100)}%
                    confidence
                  </p>
                </div>
                <span className="text-xl font-bold text-primary">
                  {r.body_fat_pct}%
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function MetricCard({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string;
  sub: string;
  tone?: 'positive' | 'negative' | 'neutral';
}) {
  const toneClass =
    tone === 'positive'
      ? 'text-emerald-600'
      : tone === 'negative'
        ? 'text-red-600'
        : 'text-foreground';
  return (
    <div className="rounded-2xl border border-border bg-card p-5 text-center shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p className={`mt-2 text-3xl font-bold ${toneClass}`}>{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{sub}</p>
    </div>
  );
}

function formatDelta(delta: number | null): string {
  if (delta === null) return '—';
  if (delta === 0) return '0.0%';
  const arrow = delta < 0 ? '▼' : '▲';
  return `${arrow} ${Math.abs(delta).toFixed(1)}%`;
}

function deltaTone(
  delta: number | null,
): 'positive' | 'negative' | 'neutral' {
  if (delta === null || delta === 0) return 'neutral';
  return delta < 0 ? 'positive' : 'negative';
}
