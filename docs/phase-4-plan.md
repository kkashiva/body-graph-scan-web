# Phase 4 — Visualization (Dashboard Trendline) Plan

## Context

Phase 3 completed the scan pipeline: users can run scans and view a single scan's results at `/scan/[id]`. Phase 4 turns `/dashboard` — currently a placeholder ("Your body scan history and trendlines will appear here") — into the primary landing page for returning users. It must surface trend-over-time for body fat % across a user's completed scans, plus quick navigation back to each individual scan. The nav bar already links to `/dashboard` (`src/app/layout.tsx:42-43`), so users will hit this page on every login.

## Scope

1. Historical body-fat trendline (Recharts) on `/dashboard`.
2. Summary stats (latest BF%, delta vs. previous, scan count, latest BMI).
3. Recent scan list linking to `/scan/[id]`.
4. Empty state for users with zero scans.

Out of scope: editing scans, CSV export, per-region trend charts (deferred).

## 1. Dependency

**Add:** `recharts` (~90 KB gz; standard React chart lib).

```
npm install recharts
```

Dates formatted via `Intl.DateTimeFormat` (same pattern as `scan/[id]/page.tsx`).

## 2. Server page — fetch history

**File:** `src/app/(authenticated)/dashboard/page.tsx` (rewrite)

Server component that:

- Auth-guards via `neonAuth()` → `redirect('/login')` (same pattern as `scan/[id]/page.tsx:46-47`).
- Queries completed scans joined with results, ordered ascending by `completed_at`:

```ts
const rows = (await sql`
  SELECT s.id, s.completed_at, s.created_at,
         r.body_fat_pct, r.bmi, r.confidence_score
  FROM scans s
  JOIN scan_results r ON r.scan_id = s.id
  WHERE s.user_id = ${user.id}
    AND s.status = 'completed'
    AND r.body_fat_pct IS NOT NULL
  ORDER BY s.completed_at ASC
`) as TrendRow[];
```

- Uses existing `sql` export from `src/lib/db.ts`.
- Renders:
  - Header.
  - **Empty state** if `rows.length === 0`: CTA linking to `/scan/new`.
  - Summary cards (latest BF%, delta, scan count, latest BMI) — reuse the `MetricCard` pattern from `scan/[id]/page.tsx:249-267`.
  - `<BodyFatTrend data={rows} />` (client component).
  - Recent scans list (most recent first, up to 10) as `<Link>` cards.

## 3. Client component — `<BodyFatTrend>`

**File (new):** `src/app/(authenticated)/dashboard/body-fat-trend.tsx`

- `'use client'` directive (matches `profile-form.tsx:1` and `scan-polling.tsx:1`).
- Props: `data: { completed_at: string; body_fat_pct: number; bmi: number; confidence_score: number }[]`.
- Renders Recharts `<ResponsiveContainer>` wrapping `<LineChart>` with:
  - `<XAxis dataKey="completed_at">` with short-date tick formatter.
  - `<YAxis>` with dynamic domain `[min-2, max+2]`.
  - `<Line dataKey="body_fat_pct" stroke="var(--primary)" />`.
  - `<Tooltip>` custom content showing date, BF%, BMI, confidence.
  - `<CartesianGrid strokeDasharray="3 3" />`.
- Uses CSS variables (`--primary`, `--muted-foreground`, `--border`) already defined in `globals.css` for theme consistency.

## 4. Summary stats (server-side derivation)

In `page.tsx`, compute before rendering:

- `latest = rows.at(-1)`
- `previous = rows.at(-2)`
- `delta = latest && previous ? latest.body_fat_pct - previous.body_fat_pct : null`
- `count = rows.length`

Show delta with `▲`/`▼` (green = decrease, red = increase), neutral `—` when `delta === null`.

## 5. Recent scans list

Below the chart: up to 10 most-recent scans, as `<Link href={\`/scan/${id}\`}>` cards showing date + BF%. Card styling mirrors measurement cards at `scan/[id]/page.tsx:172-188`.

## Files to create / modify

| Path | Action |
|------|--------|
| `package.json` / `package-lock.json` | add `recharts` |
| `src/app/(authenticated)/dashboard/page.tsx` | rewrite: fetch + layout |
| `src/app/(authenticated)/dashboard/body-fat-trend.tsx` | NEW client chart |
| `docs/phase-4-plan.md` | NEW — this file |
| `CLAUDE.md` | append Phase 4 link under Docs |

No DB migrations, no new API routes, no env var changes.

## Verification

1. `npm run build` — type + lint clean.
2. `npm run dev`, log in as a user with ≥2 completed scans; visit `/dashboard`.
   - Chart renders with correct X-axis dates and a line through all points.
   - Tooltip on hover shows date / BF% / BMI / confidence.
   - Summary cards show latest, delta, count, BMI.
   - Clicking a recent-scan card navigates to `/scan/[id]`.
3. Fresh account (zero scans) → empty state with "Start your first scan" CTA to `/scan/new`.
4. Single-scan account → chart shows one dot, delta shows `—`.
5. Responsive check at 375 px — chart fits, cards stack.

## Risks / notes

- **Recharts bundle size**: ~90 KB gz. Acceptable for hackathon; the `<BodyFatTrend>` boundary makes a later swap to a hand-rolled SVG sparkline easy.
- **Timezone**: `completed_at` is `TIMESTAMPTZ`; formatting uses browser locale.
- **Perf**: one SQL call, indexed by `idx_scans_user_created`.
