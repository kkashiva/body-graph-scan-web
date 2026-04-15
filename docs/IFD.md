# Information Flow Diagram

## End-to-End Scan Flow

```mermaid
flowchart TD
    subgraph USER_INPUT["1. User Input"]
        A[User fills /profile: gender, DOB, height, weight] --> A2[upsert into user_profiles]
        A2 --> B[Camera capture at /scan/new with silhouette overlay]
        B --> B2[Front pose + Profile pose captured to JPEG blobs]
    end

    subgraph PREPROCESSING["2. Preprocessing"]
        B2 --> C["POST /api/scan → scan row (status=uploading, snapshots h/w)"]
        C --> D["Client upload() via @vercel/blob/client → scans/&lt;id&gt;/{front,profile}.jpg"]
        D --> E["POST /api/scan/[id]/finalize → save URLs, status=analyzing"]
        E --> F[Load active analysis_config for user gender]
    end

    subgraph FAN_OUT["3. Fan-Out: Image Region Extraction"]
        F --> G{LangGraph Router}
        G --> H1[Jawline / Chin Node]
        G --> H2[Neck Node]
        G --> H3[Triceps / Arms Node]
        G --> H4[Belly / Love Handles Node]
        G --> H5[Waist / Navel Node]
        G --> H6[Hip Region Node]
        G --> H7[Forearm Vascularity Node]
        G --> H8[Chest Node]
    end

    subgraph VLM_ANALYSIS["4. Per-Region VLM Analysis"]
        H1 --> V1["VLM Call (Qwen/Gemini)\nAnalyze jawline fat"]
        H2 --> V2["VLM Call\nEstimate neck circumference"]
        H3 --> V3["VLM Call\nAnalyze tricep fat"]
        H4 --> V4["VLM Call\nAnalyze belly fat"]
        H5 --> V5["VLM Call\nEstimate waist circumference"]
        H6 --> V6["VLM Call\nEstimate hip circumference"]
        H7 --> V7["VLM Call\nAnalyze forearm vascularity"]
        H8 --> V8["VLM Call\nEstimate chest circumference"]
    end

    subgraph STORE_FEATURES["5. Store Per-Region Results"]
        V1 --> S1[feature_analyses row]
        V2 --> S2[feature_analyses row]
        V3 --> S3[feature_analyses row]
        V4 --> S4[feature_analyses row]
        V5 --> S5[feature_analyses row]
        V6 --> S6[feature_analyses row]
        V7 --> S7[feature_analyses row]
        V8 --> S8[feature_analyses row]

        V2 --> M1[body_measurements: neck]
        V5 --> M2[body_measurements: waist]
        V6 --> M3[body_measurements: hips]
        V8 --> M4[body_measurements: chest]
    end

    subgraph FAN_IN["6. Fan-In: Aggregation"]
        S1 & S2 & S3 & S4 & S5 & S6 & S7 & S8 --> AGG{Aggregation Node}
        M1 & M2 & M3 --> NAVY[Navy Formula Calculator]

        AGG --> |"weighted average\nusing feature_weights"| WBF[Weighted BF% Estimate]
        NAVY --> |"neck + waist + hips + height"| NBF[Navy BF% Estimate]

        WBF & NBF --> FINAL[Final Body Fat % + Confidence]
    end

    subgraph OUTPUT["7. Output"]
        FINAL --> RES[scan_results record]
        RES --> DASH[Dashboard: Results Display]
        RES --> TREND[Trendline Charts]
    end

    style FAN_OUT fill:#e8f4fd,stroke:#2196F3
    style VLM_ANALYSIS fill:#fff3e0,stroke:#FF9800
    style FAN_IN fill:#e8f5e9,stroke:#4CAF50
    style USER_INPUT fill:#f3e5f5,stroke:#9C27B0
```

## Capture & Upload Flow (Phase 2)

```mermaid
sequenceDiagram
    participant U as User (browser)
    participant Cam as getUserMedia stream
    participant CT as ScanCapture (client)
    participant API as Next.js API routes
    participant Blob as Vercel Blob
    participant DB as Neon PostgreSQL

    U->>CT: Open /scan/new
    CT->>API: GET (server component)
    API->>DB: SELECT user_profiles
    alt profile incomplete
        API-->>U: Banner → /profile
    else profile complete
        API-->>U: Render ScanCapture
    end

    CT->>Cam: navigator.mediaDevices.getUserMedia
    Cam-->>CT: MediaStream (9:16)
    Note over CT: SVG overlay<br/>(silhouette + thirds grid)
    U->>CT: Align + press Capture
    CT->>CT: 3-2-1 countdown
    CT->>CT: canvas.toBlob → JPEG 0.9

    U->>CT: Repeat for profile pose, then Submit

    CT->>API: POST /api/scan
    API->>DB: INSERT scans (status='uploading', h/w snapshot)
    API-->>CT: { id }

    loop front then profile
        CT->>API: POST /api/blob/upload (generate token)
        API->>DB: verify scan owner
        API-->>CT: client token (scoped to scans/&lt;id&gt;/&lt;pose&gt;.jpg)
        CT->>Blob: PUT direct upload
        Blob-->>CT: public URL
    end

    CT->>API: POST /api/scan/&lt;id&gt;/finalize { frontUrl, profileUrl }
    API->>DB: UPDATE scans SET urls, status='analyzing'
    API-->>CT: { id }
    CT-->>U: redirect /scan/&lt;id&gt;
```

## Authentication Flow

```mermaid
sequenceDiagram
    participant U as User
    participant App as Next.js App
    participant MW as Middleware
    participant NA as Neon Auth
    participant G as Google OAuth
    participant DB as Neon PostgreSQL

    U->>App: Visit /dashboard
    App->>MW: neonAuthMiddleware
    MW-->>U: Redirect to /login (no session)

    U->>App: Click "Sign in with Google"
    App->>NA: authClient.signIn.social({provider: google})
    NA->>G: OAuth redirect
    G-->>U: Google consent screen
    U->>G: Approve
    G-->>NA: Auth code
    NA->>NA: Create session, sync user to neon_auth."user"
    NA-->>App: Set session cookie
    App-->>U: Redirect to /dashboard

    U->>App: Visit /dashboard (with cookie)
    App->>MW: neonAuthMiddleware
    MW->>NA: Validate session
    NA-->>MW: Session valid
    MW-->>App: Allow request
    App->>DB: Query scans for user
    DB-->>App: Scan data
    App-->>U: Render dashboard
```

## Training / Weight Optimization Flow

```mermaid
flowchart TD
    subgraph TRAINING["Training Pipeline"]
        T1[Labeled dataset: images + known BF%] --> T2[Load training_scans from DB]
        T2 --> T3[Run fan-out pipeline on each image]
        T3 --> T4[Collect per-region estimates vs ground truth]
        T4 --> T5[Optimize feature_weights to minimize error]
        T5 --> T6[Create new analysis_config with tuned weights]
        T6 --> T7[Record weight_optimization_run with MAE/MSE]
        T7 --> T8{Accuracy acceptable?}
        T8 -->|Yes| T9[Set new config as is_active]
        T8 -->|No| T10[Adjust features / add regions / retrain]
        T10 --> T3
    end

    style TRAINING fill:#fce4ec,stroke:#E91E63
```

## Key Design Principles

1. **Fan-out mitigates hallucination** -- Each VLM call receives only an isolated body region, not the full image. This focused context produces more reliable estimates than whole-body analysis.

2. **Configurable weights** -- Each body region's contribution to the final estimate is controlled by `feature_weights`. Regions that are more reliable indicators (neck, waist) carry higher weights.

3. **Model-agnostic** -- The `model_used` field on `feature_analyses` allows different nodes to use different LLMs. We can A/B test Qwen vs Gemini per region.

4. **Auditable results** -- Every VLM response is stored as JSONB. The weight applied to each analysis is snapshotted. Results are fully reproducible and debuggable.

5. **Trendlines from snapshots** -- Height and weight are snapshotted into each scan, making trendline queries simple joins without temporal profile lookups.

6. **Standardized capture** -- The silhouette + grid overlay forces consistent framing across sessions and users. The downstream fan-out crop math assumes the body occupies a known region of the frame; without standardized capture the per-region crops would drift and the VLM estimates would regress.

7. **Client-side direct upload** -- Images go browser → Vercel Blob directly via a signed, short-lived token. This avoids the 4.5 MB serverless body-size limit and keeps image bytes off the Next.js runtime. The `/api/blob/upload` handler only mints tokens after verifying `scans.user_id` matches the session user and that the pathname matches the canonical `scans/<scanId>/<pose>.jpg` form.
