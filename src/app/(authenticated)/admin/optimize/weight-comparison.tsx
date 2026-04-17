'use client';

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

export function WeightComparison({
  current,
  candidate,
}: {
  current: Record<string, number>;
  candidate: Record<string, number>;
}) {
  // Union of feature names, ordered by candidate weight desc for readability.
  const features = Array.from(
    new Set([...Object.keys(current), ...Object.keys(candidate)]),
  ).sort((a, b) => (candidate[b] ?? 0) - (candidate[a] ?? 0));

  const data = features.map((name) => ({
    name,
    current: Number(((current[name] ?? 0) * 100).toFixed(1)),
    candidate: Number(((candidate[name] ?? 0) * 100).toFixed(1)),
  }));

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          margin={{ top: 4, right: 8, left: -16, bottom: 4 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis
            dataKey="name"
            stroke="var(--muted-foreground)"
            tick={{ fontSize: 11 }}
          />
          <YAxis
            stroke="var(--muted-foreground)"
            tick={{ fontSize: 11 }}
            unit="%"
          />
          <Tooltip
            contentStyle={{
              background: 'var(--background)',
              border: '1px solid var(--border)',
              borderRadius: 8,
              fontSize: 12,
            }}
            formatter={(v: number) => `${v}%`}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Bar dataKey="current" fill="var(--muted-foreground)" name="Active" />
          <Bar dataKey="candidate" fill="var(--primary)" name="Candidate" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
