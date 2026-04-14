# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Description

Body Graph Scan Web — estimates body fat % and body measurements from front and profile body photos using a fan-out/fan-in LangGraph pipeline with VLM analysis. Inspired by the US Navy circumference method.

## Commands

- `npm run dev` — Start dev server
- `npm run build` — Production build
- `npm run lint` — ESLint
- `npm run db:migrate` — Run database migrations against Neon

## Tech Stack

- **Framework**: Next.js 16 (App Router) with TypeScript
- **Styling**: Tailwind CSS v4
- **Database**: PostgreSQL on Neon, raw SQL via `@neondatabase/serverless` tagged templates
- **Auth**: Neon Auth (`@neondatabase/auth`) with Google OAuth
- **Deployment**: Vercel
- **AI Pipeline**: LangGraph (LangChain) for fan-out/fan-in graph orchestration, multi-LLM (Gemini, Qwen)

## Architecture

### App Structure (Next.js App Router)

- `src/app/page.tsx` — Redirects to `/dashboard`
- `src/app/login/page.tsx` — Google OAuth sign-in
- `src/app/(authenticated)/` — Route group for protected pages (dashboard, scan/new, scan/[id], profile)
- `src/app/api/auth/[...path]/route.ts` — Neon Auth catch-all handler

### Auth (Neon Auth)

- `src/lib/auth/server.ts` — `createAuthServer()` instance for server-side session access
- `src/lib/auth/client.ts` — `createAuthClient()` for client-side (useSession, signIn, signOut)
- `src/middleware.ts` — `neonAuthMiddleware({ loginUrl: '/login' })` protects all routes
- Server-side: `const { session } = await neonAuth()` or `authServer.getSession()`
- Client-side: `authClient.useSession()`, `authClient.signIn.social({ provider: 'google', callbackURL })`, `authClient.signOut()`
- Auth users stored in `neon_auth."user"` table (managed by Neon, UUID primary key)

### Database

- `src/lib/db.ts` — Neon SQL client (`sql` tagged template, auto-parameterized)
- `src/db/migrations/` — Numbered `.sql` migration files
- `src/db/migrate.ts` — Migration runner (reads SQL files, tracks in `_migrations` table)

### Key Tables

- `user_profiles` — 1:1 with auth user (gender, DOB, height, weight)
- `scans` — Each scan session with image URLs + height/weight snapshots
- `scan_results` — Aggregated body fat %, BMI, confidence (1:1 with scans)
- `body_measurements` — Circumference estimates per region (neck, waist, hips are primary for Navy formula)
- `feature_analyses` — Per-region VLM results from LangGraph pipeline (core fan-out table)
- `analysis_configs` + `feature_weights` — Versioned weight configurations per body region
- `training_scans` + `weight_optimization_runs` — Training data and tuning run tracking

### Body Fat Estimation Approach

Uses US Navy circumference method as baseline:
- Male: BF% = 86.010 × log10(waist - neck) - 70.041 × log10(height) + 36.76
- Female: BF% = 163.205 × log10(waist + hip - neck) - 97.684 × log10(height) + 78.387
- Height is user input; neck, waist, hip circumferences are derived from images via VLM

## Environment Variables

See `.env.example`. Required:
- `DATABASE_URL` — Neon PostgreSQL connection string
- `NEON_AUTH_BASE_URL` — Neon Auth endpoint URL
- `NEON_AUTH_COOKIE_SECRET` — Secret for auth cookies (generate with `openssl rand -base64 32`)
