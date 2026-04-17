'use client';

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

export type TrendPoint = {
  completed_at: string;
  body_fat_pct: number;
  bmi: number;
  confidence_score: number;
};

const shortDate = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
});

const longDate = new Intl.DateTimeFormat('en-US', {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
});

export function BodyFatTrend({ data }: { data: TrendPoint[] }) {
  const values = data.map((d) => d.body_fat_pct);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const pad = Math.max(1, (max - min) * 0.2);
  const domain: [number, number] = [
    Math.max(0, Math.floor(min - pad)),
    Math.ceil(max + pad),
  ];

  return (
    <div className="h-72 w-full rounded-2xl border border-border bg-card p-4">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis
            dataKey="completed_at"
            tickFormatter={(v: string) => shortDate.format(new Date(v))}
            stroke="var(--muted-foreground)"
            fontSize={12}
          />
          <YAxis
            domain={domain}
            stroke="var(--muted-foreground)"
            fontSize={12}
            tickFormatter={(v: number) => `${v}%`}
            width={48}
          />
          <Tooltip
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const p = payload[0].payload as TrendPoint;
              return (
                <div className="rounded-lg border border-border bg-card px-3 py-2 text-xs shadow-md">
                  <p className="font-medium text-foreground">
                    {longDate.format(new Date(p.completed_at))}
                  </p>
                  <p className="mt-1 text-muted-foreground">
                    Body fat:{' '}
                    <span className="font-semibold text-foreground">
                      {p.body_fat_pct}%
                    </span>
                  </p>
                  <p className="text-muted-foreground">
                    BMI:{' '}
                    <span className="font-semibold text-foreground">
                      {p.bmi}
                    </span>
                  </p>
                  <p className="text-muted-foreground">
                    Confidence:{' '}
                    <span className="font-semibold text-foreground">
                      {Math.round(p.confidence_score * 100)}%
                    </span>
                  </p>
                </div>
              );
            }}
          />
          <Line
            type="monotone"
            dataKey="body_fat_pct"
            stroke="var(--primary)"
            strokeWidth={2}
            dot={{ r: 4, fill: 'var(--primary)' }}
            activeDot={{ r: 6 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
