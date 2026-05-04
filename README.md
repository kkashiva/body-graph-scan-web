# Body Scan

**Qwen AI Build Day Hackathon -- Healthcare Track, Challenge #2**

Measuring body fat % typically requires specialized, expensive equipment (DEXA scans, BodPod, hydrostatic weighing). Most people don't have easy access. Body Scan solves this by estimating body fat percentage and body measurements from just two photos -- a front view and a side profile.

## How It Works

1. **User fills in** gender, date of birth, height, and weight on `/profile`.
2. **User captures** a front-facing and side-profile photo using the in-browser camera. A translucent silhouette + alignment grid overlay on the live video feed guides consistent framing so the downstream crop/fan-out logic behaves the same for every scan.
3. **Photos upload directly** to Vercel Blob from the browser (bypassing serverless body-size limits) under a per-scan namespace (`scans/<scanId>/{front,profile}.jpg`).
4. **AI graph pipeline** (Phase 3) breaks each image into isolated body regions (jawline, neck, triceps, belly, love handles, forearms, etc.) and analyzes each one independently using a Vision-Language Model.
5. **Fan-in aggregation** combines per-region estimates with configurable weights to produce a final body fat % and circumference measurements.
6. **Results are stored** so users can track their body composition trends over time with charts.

### Why a Graph Architecture?

Asking a single VLM to analyze an entire body photo at once leads to hallucination and unreliable estimates. By **fanning out** the image into focused regions -- each analyzed in isolation with managed context -- and then **fanning in** the results with tunable weights, we get significantly more accurate and reproducible data.

This is implemented using [LangGraph](https://langchain-ai.github.io/langgraphjs/) (LangChain), where each graph node represents a specific body region analysis. The architecture also supports:

- **Swappable LLMs** -- switch between Gemini and Qwen models per node
- **Configurable weights** -- control how much each body region contributes to the final estimate
- **Training pipeline** -- refine feature extraction and weights from labeled datasets (supervised learning)

### Estimation Method

Inspired by the **US Navy circumference method**, which estimates body fat from neck, waist, and hip circumferences combined with height. In our approach, the VLM-derived circumferences replace tape measurements:

- **Male:** BF% = 86.010 x log10(waist - neck) - 70.041 x log10(height) + 36.76
- **Female:** BF% = 163.205 x log10(waist + hip - neck) - 97.684 x log10(height) + 78.387

Height is the only user-provided measurement. All circumferences are estimated from the photos.

```mermaid
flowchart TD
    %% ================= Input =================
    FRONT["📷 Front pose<br/>(JPEG)"]:::input
    PROFILE["📷 Profile pose<br/>(JPEG)"]:::input

    FRONT --> CROP
    PROFILE --> CROP

    CROP["🪚 crop_images node<br/>sharp.extract × 8 regions<br/>silhouette viewBox → pixels"]:::node

    %% ================= Fan-Out: 8 parallel VLM calls =================
    CROP -->|Send| R1
    CROP -->|Send| R2
    CROP -->|Send| R3
    CROP -->|Send| R4
    CROP -->|Send| R5
    CROP -->|Send| R6
    CROP -->|Send| R7
    CROP -->|Send| R8

    subgraph FANOUT["⚡ Fan-Out — 8 parallel Qwen VL calls"]
        direction LR
        R1["Jawline / Chin<br/>→ local_bf %"]:::visual
        R2["Neck<br/>→ local_bf % + neck cm"]:::both
        R3["Triceps / Arms<br/>→ local_bf %"]:::visual
        R4["Chest<br/>→ local_bf % + chest cm"]:::both
        R5["Belly / Love Handles<br/>→ local_bf %"]:::visual
        R6["Waist / Navel<br/>→ local_bf % + waist cm"]:::both
        R7["Hips<br/>→ local_bf % + hip cm"]:::both
        R8["Forearm Vascularity<br/>→ local_bf %"]:::visual
    end

    %% ================= Fan-In routing =================
    R1 --> WEIGHTED
    R2 --> WEIGHTED
    R3 --> WEIGHTED
    R4 --> WEIGHTED
    R5 --> WEIGHTED
    R6 --> WEIGHTED
    R7 --> WEIGHTED
    R8 --> WEIGHTED

    R2 --> NAVY
    R4 --> NAVY
    R6 --> NAVY
    R7 --> NAVY

    %% ================= Fan-In: 2 independent estimators =================
    subgraph FANIN["🧮 Fan-In — aggregate node"]
        direction LR
        WEIGHTED["Σ w_r × local_bf_r / Σ w_r<br/>(learned weights per gender)"]:::agg
        NAVY["US Navy formula<br/>log(waist ± neck [± hips]) · height"]:::agg
    end

    WEIGHTED --> BLEND
    NAVY --> BLEND

    BLEND{"50 / 50 blend<br/>clamp 3–55 %"}:::blend

    BLEND --> OUT

    OUT["📊 scan_results<br/>body_fat_pct · confidence · method"]:::output

    %% ================= Styling =================
    classDef input   fill:#1E3A8A,stroke:#93C5FD,stroke-width:2px,color:#FFFFFF
    classDef node    fill:#334155,stroke:#94A3B8,stroke-width:1px,color:#F1F5F9
    classDef visual  fill:#7C2D12,stroke:#FDBA74,stroke-width:1px,color:#FFEDD5
    classDef both    fill:#78350F,stroke:#F59E0B,stroke-width:2px,color:#FEF3C7
    classDef agg     fill:#064E3B,stroke:#6EE7B7,stroke-width:1px,color:#D1FAE5
    classDef blend   fill:#581C87,stroke:#D8B4FE,stroke-width:2px,color:#F3E8FF
    classDef output  fill:#0F172A,stroke:#F59E0B,stroke-width:3px,color:#FFFFFF
```

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | Next.js 16 (App Router), TypeScript, Tailwind CSS v4 |
| Camera | Browser `MediaDevices.getUserMedia` + SVG silhouette overlays |
| Image Storage | [Vercel Blob](https://vercel.com/docs/storage/vercel-blob) (client-upload) |
| Database | PostgreSQL on [Neon](https://neon.tech) |
| Auth | Neon Auth (Google OAuth) |
| AI Pipeline | [LangGraph](https://langchain-ai.github.io/langgraphjs/) (LangChain JS) -- fan-out/fan-in graph |
| Image Processing | [sharp](https://sharp.pixelplumbing.com/) -- server-side region cropping |
| LLM Providers | Google Gemini, Qwen VL (via [OpenRouter](https://openrouter.ai)) |
| Hosting | Vercel |

## Implementation Status

- [x] **Phase 1** -- Auth (Google OAuth via Neon Auth) + full DB schema with migration runner
- [x] **Phase 2** -- Profile form, standardized in-browser camera capture with silhouette overlays, Vercel Blob upload pipeline
- [x] **Phase 3** -- LangGraph fan-out/fan-in VLM analysis, Navy-formula aggregation, results page with polling
- [x] **Phase 4** -- Dashboard with historical scans and trendline charts (Recharts)
- [x] **Phase 5** -- Admin "ML weight refinement" loop: upload labeled training images, score via the production pipeline, run coordinate-descent optimizer over `feature_weights` to minimize MSE vs known BF%, promote the best config live

## Architecture

See detailed diagrams:
- [Database ERD](docs/ERD.md)
```mermaid
---
config:
  layout: dagre
---
erDiagram
    NEON_AUTH_USER {
        UUID id PK
        TEXT email
        TEXT name
        JSONB raw_json
        TIMESTAMPTZ created_at
        TIMESTAMPTZ updated_at
    }
    USER_PROFILES {
        UUID user_id PK, FK
        TEXT gender "male | female | other"
        DATE date_of_birth
        NUMERIC height_cm
        NUMERIC weight_kg
        BOOLEAN is_admin "gates /admin/* — set manually in Neon"
        TIMESTAMPTZ created_at
        TIMESTAMPTZ updated_at
    }

    ANALYSIS_CONFIGS {
        UUID id PK
        TEXT name "e.g. v1-male-default"
        TEXT description
        TEXT gender_target "male | female | any"
        BOOLEAN is_active "partial unique per gender"
        TIMESTAMPTZ created_at
    }

    FEATURE_WEIGHTS {
        UUID id PK
        UUID config_id FK
        TEXT feature_name "jawline, neck, triceps, belly..."
        NUMERIC weight "0.000 - 1.000"
        TIMESTAMPTZ created_at
    }

    SCANS {
        UUID id PK
        UUID user_id FK
        UUID analysis_config_id FK "nullable"
        TEXT status "pending | uploading | analyzing | completed | failed"
        TEXT front_image_url
        TEXT profile_image_url
        NUMERIC height_cm_snapshot
        NUMERIC weight_kg_snapshot
        TEXT error_message
        TIMESTAMPTZ created_at
        TIMESTAMPTZ completed_at
    }

    SCAN_RESULTS {
        UUID id PK
        UUID scan_id FK, UK
        NUMERIC body_fat_pct "e.g. 18.5"
        NUMERIC bmi
        TEXT method "navy_circumference | weighted_graph"
        NUMERIC confidence_score "0.00 - 1.00"
        TEXT notes
        TIMESTAMPTZ created_at
    }

    BODY_MEASUREMENTS {
        UUID id PK
        UUID scan_id FK
        TEXT region "neck | waist | hips | chest | bicep | thigh | calf"
        NUMERIC value_cm
        NUMERIC confidence "0.00 - 1.00"
        BOOLEAN is_primary "true for Navy formula inputs"
        TIMESTAMPTZ created_at
    }

    FEATURE_ANALYSES {
        UUID id PK
        UUID scan_id FK
        UUID feature_weight_id FK "nullable"
        TEXT feature_name
        TEXT image_type "front | profile | both"
        NUMERIC local_bf_estimate
        NUMERIC confidence "0.00 - 1.00"
        NUMERIC weight_applied "snapshot"
        JSONB raw_llm_response
        TEXT model_used "gemini-2.0-flash, qwen-vl-max..."
        INTEGER latency_ms
        TIMESTAMPTZ created_at
    }

    TRAINING_SCANS {
        UUID id PK
        UUID user_id FK "nullable — admin uploader"
        UUID scan_id FK "nullable — links to scored scans row"
        TEXT front_image_url
        TEXT profile_image_url
        NUMERIC known_bf_pct "ground truth"
        TEXT gender
        NUMERIC height_cm
        NUMERIC weight_kg
        TEXT source "dexa | bodpod | user_reported"
        TIMESTAMPTZ scored_at "when pipeline ran"
        TIMESTAMPTZ created_at
    }

    WEIGHT_OPTIMIZATION_RUNS {
        UUID id PK
        UUID config_id_produced FK "nullable — candidate config written"
        TEXT gender_target "male | female"
        INTEGER training_scan_count
        NUMERIC baseline_mse "MSE of active weights on this sample"
        NUMERIC mean_squared_error "final MSE after optimization"
        NUMERIC mean_absolute_error
        JSONB final_weights "snapshot of the optimized vector"
        INTEGER iterations "accepted coordinate-descent moves"
        TEXT notes
        TIMESTAMPTZ started_at
        TIMESTAMPTZ completed_at
    }
    NEON_AUTH_USER ||--o| USER_PROFILES : "has profile"
    NEON_AUTH_USER ||--o{ SCANS : "creates"
    NEON_AUTH_USER ||--o{ TRAINING_SCANS : "contributes"

    SCANS ||--|| SCAN_RESULTS : "produces"
    SCANS ||--o{ BODY_MEASUREMENTS : "derives"
    SCANS ||--o{ FEATURE_ANALYSES : "generates"
    SCANS }o--o| ANALYSIS_CONFIGS : "uses"

    ANALYSIS_CONFIGS ||--o{ FEATURE_WEIGHTS : "contains"
    FEATURE_WEIGHTS ||--o{ FEATURE_ANALYSES : "applied in"

    TRAINING_SCANS }o--o| SCANS : "scored via synthetic scan"
    WEIGHT_OPTIMIZATION_RUNS }o--o| ANALYSIS_CONFIGS : "produces"
```

  
- [Information Flow Diagram](docs/IFD.md)

```mermaid
flowchart TD
    subgraph AUTH["1. Authentication"]
        A1[User visits /dashboard] --> A2{Session cookie?}
        A2 -->|No| A3[Redirect to /login]
        A3 --> A4[Sign in with Google]
        A4 --> A5[Neon Auth OAuth → sync to neon_auth.user]
        A5 --> A6[Session cookie set]
        A2 -->|Yes| A6
        A6 --> A7[neonAuthMiddleware validates on each request]
    end

    subgraph PROFILE["2. Profile Setup"]
        A7 --> B1["User fills /profile:<br/>gender, DOB, height, weight"]
        B1 --> B2[upsert user_profiles]
    end

    subgraph CAPTURE["3. Capture & Upload"]
        B2 --> C1[Open /scan/new]
        C1 --> C2{profile complete?}
        C2 -->|No| B1
        C2 -->|Yes| C3[getUserMedia 9:16 + SVG silhouette overlay]
        C3 --> C4["3-2-1 countdown → canvas.toBlob JPEG 0.9<br/>front pose + profile pose"]
        C4 --> C5["POST /api/scan → INSERT scans<br/>(status=uploading, h/w snapshot)"]
        C5 --> C6["POST /api/blob/upload mints scoped token<br/>after verifying scans.user_id"]
        C6 --> C7["Client PUT direct to Vercel Blob<br/>scans/<id>/{front,profile}.jpg"]
        C7 --> C8["POST /api/scan/[id]/finalize<br/>UPDATE scans SET urls, status=analyzing"]
    end

    subgraph PIPELINE["4. LangGraph Pipeline (background via after())"]
        C8 --> D1[runPipeline scanId]
        D1 --> D2["Load scan + profile + active analysis_config<br/>by gender_target"]
        D2 --> D3["crop.ts: fetch blobs → sharp.extract × 8 regions"]
        D3 --> D4{"LangGraph Send fan-out<br/>8 parallel analyze_region"}

        D4 --> R1[Jawline / Chin]
        D4 --> R2[Neck]
        D4 --> R3[Triceps / Arms]
        D4 --> R4[Belly / Love Handles]
        D4 --> R5[Waist / Navel]
        D4 --> R6[Hip Region]
        D4 --> R7[Forearm Vascularity]
        D4 --> R8[Chest]

        R1 --> V1["VLM Gemini/Qwen<br/>JSON: local_bf, confidence, explanation"]
        R2 --> V2["VLM<br/>+ circumference_cm"]
        R3 --> V3[VLM]
        R4 --> V4[VLM]
        R5 --> V5["VLM<br/>+ circumference_cm"]
        R6 --> V6["VLM<br/>+ circumference_cm"]
        R7 --> V7[VLM]
        R8 --> V8["VLM<br/>+ circumference_cm"]

        V1 & V2 & V3 & V4 & V5 & V6 & V7 & V8 --> D5[aggregate.ts fan-in]
        D5 --> D6["Weighted avg BF% using feature_weights"]
        D5 --> D7["Navy BF% from neck+waist+hips+height"]
        D6 & D7 --> D8["50/50 blend → clamp 3..55 → Final BF% + Confidence"]

        D8 --> D9[INSERT feature_analyses × 8]
        D8 --> D10[INSERT body_measurements neck/waist/hips/chest]
        D8 --> D11[INSERT scan_results]
        D8 --> D12[UPDATE scans status=completed or failed]
    end

    subgraph POLL["5. Status Polling & Results"]
        C8 --> E1["Client redirected to /scan/id<br/>renders spinner"]
        E1 --> E2["ScanPolling: GET /api/scan/id/status every 3s"]
        E2 --> E3{status?}
        E3 -->|analyzing| E2
        E3 -->|completed/failed| E4[router.refresh]
        D12 -.status flip.-> E3
        E4 --> E5["Render results: BF%, per-region breakdown"]
        E5 --> E6[Dashboard + Trendline Charts]
    end

    subgraph TRAIN["6. Admin Training Ingest"]
        T1[Admin at /admin/training uploads labeled photos] --> T2["POST /api/admin/training/upload<br/>blob token"]
        T2 --> T3["Direct upload training/<tempId>/{front,profile}.jpg"]
        T3 --> T4["POST /api/admin/training<br/>INSERT training_scans known_bf_pct + gender"]
    end

    subgraph SCORE["7. Score Training Samples"]
        T4 --> N1["Admin: 'Score all unscored'"]
        N1 --> N2[POST /api/admin/training/score-all]
        N2 --> N3{"For each training_scan<br/>WHERE scan_id IS NULL"}
        N3 --> N4[INSERT synthetic scans row owned by admin]
        N4 --> N5[runPipelineWithInputs with LABELED gender]
        N5 -.reuses.-> D1
        N5 --> N6["UPDATE training_scans SET scan_id, scored_at"]
        N6 --> N3
    end

    subgraph OPT["8. Optimize Weight Vector"]
        O1["Admin: 'Optimize male/female' at /admin/optimize"] --> O2[POST /api/admin/optimize]
        O2 --> O3["loadSamples: JOIN training_scans →<br/>feature_analyses + body_measurements"]
        O3 --> O4["Recompute Navy BF from stored circumferences<br/>via shared navy.ts"]
        O4 --> O5["Coordinate descent:<br/>transfer weight between region pairs"]
        O5 --> O6{MSE improved?}
        O6 -->|Yes| O7[Accept move]
        O6 -->|No| O8[Halve step]
        O7 --> O5
        O8 --> O5
        O5 --> O9["Converge when step < minStep"]
    end

    subgraph PROMOTE["9. Persist + Promote"]
        O9 --> P1["INSERT analysis_configs is_active=false<br/>gender_target=X"]
        P1 --> P2[INSERT feature_weights rows]
        P2 --> P3["INSERT weight_optimization_runs<br/>baseline_mse, final_mse, MAE, iters"]
        P3 --> P4{"Admin reviews bar chart<br/>current vs candidate"}
        P4 -->|Promote| P5["POST /api/admin/optimize/promote<br/>flip is_active"]
        P4 -->|Keep| P6[Candidate stays inactive]
        P5 -.new active config.-> D2
    end
```

## Getting Started

### Prerequisites

- Node.js 18+
- A [Neon](https://neon.tech) database with Auth enabled
- Google OAuth credentials configured in Neon Auth
- A Vercel Blob store (create one in the Vercel dashboard -- Storage -> Blob). In production the `BLOB_READ_WRITE_TOKEN` is injected automatically when the store is linked to the project.

### Setup

```bash
# Install dependencies
npm install

# Copy environment template and fill in your values
cp .env.example .env.local

# Run database migrations
npm run db:migrate

# Start development server
npm run dev

# (Optional) Run the offline weight optimizer once you've uploaded
# labeled training scans through /admin/training
npm run optimize:weights -- --gender male
npm run optimize:weights -- --gender female --persist
```

### Environment Variables

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | Neon PostgreSQL connection string |
| `NEON_AUTH_BASE_URL` | Neon Auth endpoint URL |
| `NEON_AUTH_COOKIE_SECRET` | Auth cookie secret (`openssl rand -base64 32`) |
| `BLOB_READ_WRITE_TOKEN` | Vercel Blob store token (auto-injected on Vercel when a store is linked; required in `.env.local` for local uploads) |
| `VLM_PROVIDER` | `gemini` (default) or `qwen` |
| `VLM_MODEL` | Model name override (default: `gemini-2.0-flash` / `qwen/qwen2.5-vl-72b-instruct`) |
| `GOOGLE_API_KEY` | Google AI API key (required when `VLM_PROVIDER=gemini`) |
| `OPENROUTER_API_KEY` | OpenRouter API key (required when `VLM_PROVIDER=qwen`) |

### Admin access

The `/admin/training` and `/admin/optimize` pages are gated by `user_profiles.is_admin`. There is no UI for self-promotion — set the flag directly in Neon Studio:

```sql
UPDATE user_profiles SET is_admin = true WHERE user_id = '<your-uuid>';
```

The header shows `Training` and `Optimize` links only for admins; regular users won't see them and direct navigation to `/admin/*` returns 404.

### Local camera testing

`getUserMedia` is gated to secure contexts. `http://localhost:3000` counts as secure, so `npm run dev` works without extra setup. If you need to test from another device on your LAN, front the dev server with an HTTPS tunnel.

## Project Structure

```
src/
  app/
    login/                          # Google OAuth sign-in
    (authenticated)/                # Protected routes
      dashboard/                    # Scan history + trendline charts (Phase 4)
      admin/
        training/                   # Upload labeled scans + "Score all" action (Phase 5)
        optimize/                   # Run optimizer, compare weight vectors, promote (Phase 5)
      profile/
        page.tsx                    # Server: loads user_profiles
        profile-form.tsx            # Client: gender / DOB / height / weight
      scan/new/
        page.tsx                    # Server: profile-completeness guard
        scan-capture.tsx            # Client: 3-step front/profile/review flow
        silhouette.tsx              # Front + profile silhouette SVGs, alignment grid
      scan/[id]/
        page.tsx                    # Server: scan results (analyzing/completed/failed)
        scan-polling.tsx            # Client: 3s polling during analysis
    api/
      auth/[...path]/               # Neon Auth catch-all handler
      profile/                      # POST -- upsert user_profiles
      scan/                         # POST -- create scan (status=uploading, snapshots h/w)
      scan/[id]/finalize/           # POST -- save blob URLs, dispatch pipeline via after()
      scan/[id]/status/             # GET -- lightweight status polling endpoint
      blob/upload/                  # handleUpload token handler for @vercel/blob
      admin/
        training/                   # POST upload (blob token), POST insert training_scan,
                                    #   POST score-all (runs pipeline against each unscored row)
        optimize/                   # POST run optimizer, POST promote candidate config
  lib/
    auth/                           # Auth server + client config
    db.ts                           # Neon SQL client
    admin.ts                        # DB-backed isAdmin(userId) gate (Phase 5)
    pipeline/
      state.ts                      # LangGraph state annotation (Annotation.Root)
      regions.ts                    # 8 body region definitions (bounding boxes + prompts)
      providers.ts                  # VLM factory (Gemini / Qwen via OpenRouter)
      crop.ts                       # Node 1: image download + sharp crop per region
      analyze.ts                    # Nodes 2-9: multimodal VLM call per region (fan-out)
      aggregate.ts                  # Node 10: weighted avg + Navy formula + DB writes (fan-in)
      navy.ts                       # Shared Navy-formula helper (used by aggregator + optimizer)
      graph.ts                      # Graph wiring, runPipeline / runPipelineWithInputs
    optimize/
      weight-optimizer.ts           # Pure coordinate-descent over the weight vector (Phase 5)
      load-samples.ts               # Build OptimizerSample[] from scored training scans
  scripts/
    optimize-weights.ts             # CLI entry for `npm run optimize:weights`
  db/
    migrations/
      001_create_schema.sql         # Full DB schema
      002_seed_analysis_configs.sql # Default male/female feature weights
      003_phase5_training.sql       # is_admin flag, training_scan linkage, run snapshot cols
    migrate.ts                      # Migration runner
```

## Scan Capture Flow

The `/scan/new` experience is a three-step client flow, gated server-side on profile completeness:

1. **Front pose** -- Live camera with a green body silhouette overlay and rule-of-thirds grid. User aligns body inside the silhouette; a 3-second countdown gives time to settle before the canvas grab.
2. **Profile (side) pose** -- Same UI with a blue side-profile silhouette.
3. **Review** -- Thumbnails of both captures with retake buttons; Submit sends both images through the upload pipeline.

Submit triggers:

```
POST /api/scan                 -> { id }  (status='uploading')
@vercel/blob upload() x2       -> scans/<id>/{front,profile}.jpg
POST /api/scan/<id>/finalize   -> status='analyzing', response sent immediately
  └─ after() dispatches LangGraph pipeline in background
       ├─ crop_images: sharp crops 8 body regions from front image
       ├─ analyze_region ×8: parallel VLM calls (Gemini or Qwen)
       └─ aggregate: weighted avg + Navy formula → scan_results
```

The captured frame is written un-mirrored even when the user-facing camera is selected, so anatomical left/right stays correct for the downstream VLM.

### Analysis Pipeline

After finalize, the client redirects to `/scan/<id>` which polls `GET /api/scan/<id>/status` every 3 seconds. The LangGraph pipeline runs in the background via Next.js `after()`:

1. **Crop** -- Downloads both images from Vercel Blob, crops 8 body regions using `sharp` based on bounding boxes mapped from the silhouette viewBox (100x177) to actual pixel coordinates.
2. **Analyze (fan-out)** -- 8 parallel VLM calls, one per region. Each receives a cropped image + a tuned system prompt requesting a JSON response with `local_bf_estimate`, `confidence`, `explanation`, and optionally `circumference_cm`.
3. **Aggregate (fan-in)** -- Computes weighted average BF% from per-region estimates, Navy formula BF% from circumference estimates, BMI, and writes `feature_analyses`, `body_measurements`, and `scan_results` rows. Sets `scans.status = 'completed'`.

The VLM provider is controlled by `VLM_PROVIDER` env var (`gemini` or `qwen`). Qwen is accessed via [OpenRouter](https://openrouter.ai) since DashScope is unavailable in India.

## Weight Optimization (Phase 5)

The aggregator blends a weighted average of per-region BF estimates (50%) with the Navy-formula estimate (50%). The 8 weights originally came from hand-tuned guesses seeded in `002_seed_analysis_configs.sql`. Phase 5 refines those weights against ground truth:

1. **Upload labeled data** at `/admin/training`: front + profile photos, known BF% (from DEXA / BodPod / hydrostatic weighing), gender, optional height / weight, and a free-text source.
2. **Score** each unscored row — clicking "Score all" creates a synthetic `scans` row per training sample and runs the same LangGraph pipeline used in production, so per-region estimates land in `feature_analyses` and circumferences land in `body_measurements`.
3. **Optimize** at `/admin/optimize`: coordinate-descent search over the weight vector starting from the currently-active config, transferring probability mass between region pairs and accepting the best improving move each pass. Loss function mirrors the aggregator's 50/50 Navy blend exactly (see `src/lib/optimize/weight-optimizer.ts`).
4. **Promote** the candidate: toggling `is_active` via the partial unique index on `analysis_configs(gender_target) WHERE is_active = true` atomically swaps the live config. The next real scan picks up the new weights.

Because per-region estimates are persisted after scoring, the optimizer runs in milliseconds — no additional VLM calls. The CLI `npm run optimize:weights` mirrors the in-app flow for demos and headless runs.

## Target Audience

Health-conscious people following a fitness routine who want to track body composition changes over time without expensive equipment. Users are expected to have access to a regular scale and tape measure for height -- the app handles everything else from photos.

## License

MIT
