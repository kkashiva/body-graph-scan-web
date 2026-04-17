import { neonAuth } from '@neondatabase/auth/next/server';
import { notFound, redirect } from 'next/navigation';
import { sql } from '@/lib/db';
import { isAdmin } from '@/lib/admin';
import { TrainingUploader } from './training-uploader';
import { ScoreAllButton } from './score-all-button';

type Row = {
  id: string;
  front_image_url: string;
  gender: 'male' | 'female';
  known_bf_pct: number;
  scored_at: string | null;
  predicted_bf: number | null;
  source: string | null;
};

const fmt = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
});

export default async function AdminTrainingPage() {
  const { user } = await neonAuth();
  if (!user) redirect('/login');
  if (!(await isAdmin(user.id))) notFound();

  const rows = (await sql`
    SELECT t.id,
           t.front_image_url,
           t.gender,
           t.known_bf_pct::float AS known_bf_pct,
           t.scored_at,
           r.body_fat_pct::float AS predicted_bf,
           t.source
    FROM training_scans t
    LEFT JOIN scan_results r ON r.scan_id = t.scan_id
    ORDER BY t.created_at DESC
  `) as Row[];

  const unscoredCount = rows.filter((r) => !r.scored_at).length;

  return (
    <div className="space-y-8 pb-12">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">
          Training Data
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Upload labeled image pairs (DEXA, BodPod, etc.) to refine the
          per-region weight vector. {rows.length}{' '}
          {rows.length === 1 ? 'sample' : 'samples'} on file
          {unscoredCount > 0 ? `, ${unscoredCount} unscored.` : '.'}
        </p>
      </div>

      <TrainingUploader />

      {rows.length > 0 && (
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-foreground">Samples</h2>
            <ScoreAllButton disabled={unscoredCount === 0} count={unscoredCount} />
          </div>

          <div className="overflow-hidden rounded-xl border border-border">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left">Image</th>
                  <th className="px-3 py-2 text-left">Gender</th>
                  <th className="px-3 py-2 text-right">Known BF%</th>
                  <th className="px-3 py-2 text-right">Predicted</th>
                  <th className="px-3 py-2 text-right">Abs error</th>
                  <th className="px-3 py-2 text-left">Scored</th>
                  <th className="px-3 py-2 text-left">Source</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const err =
                    r.predicted_bf !== null
                      ? Math.abs(r.predicted_bf - r.known_bf_pct)
                      : null;
                  return (
                    <tr key={r.id} className="border-t border-border">
                      <td className="px-3 py-2">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={r.front_image_url}
                          alt="front"
                          className="h-12 w-8 rounded object-cover"
                        />
                      </td>
                      <td className="px-3 py-2 capitalize">{r.gender}</td>
                      <td className="px-3 py-2 text-right font-mono">
                        {r.known_bf_pct.toFixed(1)}%
                      </td>
                      <td className="px-3 py-2 text-right font-mono">
                        {r.predicted_bf !== null
                          ? `${r.predicted_bf.toFixed(1)}%`
                          : '—'}
                      </td>
                      <td className="px-3 py-2 text-right font-mono">
                        {err !== null ? `${err.toFixed(1)}` : '—'}
                      </td>
                      <td className="px-3 py-2 text-muted-foreground">
                        {r.scored_at
                          ? fmt.format(new Date(r.scored_at))
                          : 'unscored'}
                      </td>
                      <td className="px-3 py-2 text-muted-foreground">
                        {r.source ?? '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
