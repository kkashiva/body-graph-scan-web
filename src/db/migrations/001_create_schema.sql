-- 001_create_schema.sql
-- Body Graph Scan — full schema

-- ============================================================
-- User Profiles (fitness-specific data, 1:1 with neon_auth."user")
-- ============================================================
CREATE TABLE IF NOT EXISTS user_profiles (
  user_id       UUID PRIMARY KEY REFERENCES neon_auth."user"(id) ON DELETE CASCADE,
  gender        TEXT CHECK (gender IN ('male', 'female', 'other')),
  date_of_birth DATE,
  height_cm     NUMERIC(5,1),
  weight_kg     NUMERIC(5,1),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- Analysis Configs (named, versioned weight configurations)
-- ============================================================
CREATE TABLE IF NOT EXISTS analysis_configs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL,
  description   TEXT,
  gender_target TEXT CHECK (gender_target IN ('male', 'female', 'any')),
  is_active     BOOLEAN NOT NULL DEFAULT false,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Only one active config per gender target
CREATE UNIQUE INDEX IF NOT EXISTS idx_active_config_per_gender
  ON analysis_configs (gender_target) WHERE is_active = true;

-- ============================================================
-- Feature Weights (per-region weights within a config)
-- ============================================================
CREATE TABLE IF NOT EXISTS feature_weights (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id     UUID NOT NULL REFERENCES analysis_configs(id) ON DELETE CASCADE,
  feature_name  TEXT NOT NULL,
  weight        NUMERIC(4,3) NOT NULL CHECK (weight >= 0 AND weight <= 1),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (config_id, feature_name)
);

-- ============================================================
-- Scans (each scan session)
-- ============================================================
CREATE TABLE IF NOT EXISTS scans (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID NOT NULL REFERENCES neon_auth."user"(id) ON DELETE CASCADE,
  analysis_config_id  UUID REFERENCES analysis_configs(id),
  status              TEXT NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending', 'uploading', 'analyzing', 'completed', 'failed')),
  front_image_url     TEXT,
  profile_image_url   TEXT,
  height_cm_snapshot  NUMERIC(5,1),
  weight_kg_snapshot  NUMERIC(5,1),
  error_message       TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at        TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_scans_user_id ON scans(user_id);
CREATE INDEX IF NOT EXISTS idx_scans_user_created ON scans(user_id, created_at DESC);

-- ============================================================
-- Scan Results (aggregated results, 1:1 with scans)
-- ============================================================
CREATE TABLE IF NOT EXISTS scan_results (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scan_id           UUID NOT NULL UNIQUE REFERENCES scans(id) ON DELETE CASCADE,
  body_fat_pct      NUMERIC(4,1),
  bmi               NUMERIC(4,1),
  method            TEXT,
  confidence_score  NUMERIC(3,2),
  notes             TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- Body Measurements (circumference estimates derived from images)
-- ============================================================
CREATE TABLE IF NOT EXISTS body_measurements (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scan_id       UUID NOT NULL REFERENCES scans(id) ON DELETE CASCADE,
  region        TEXT NOT NULL CHECK (region IN (
                  'neck', 'waist', 'hips', 'chest',
                  'left_bicep', 'right_bicep',
                  'left_thigh', 'right_thigh',
                  'left_calf', 'right_calf'
                )),
  value_cm      NUMERIC(5,1) NOT NULL,
  confidence    NUMERIC(3,2),
  is_primary    BOOLEAN NOT NULL DEFAULT false,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (scan_id, region)
);

-- ============================================================
-- Feature Analyses (per-region VLM results from LangGraph pipeline)
-- ============================================================
CREATE TABLE IF NOT EXISTS feature_analyses (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scan_id           UUID NOT NULL REFERENCES scans(id) ON DELETE CASCADE,
  feature_weight_id UUID REFERENCES feature_weights(id),
  feature_name      TEXT NOT NULL,
  image_type        TEXT NOT NULL CHECK (image_type IN ('front', 'profile', 'both')),
  local_bf_estimate NUMERIC(4,1),
  confidence        NUMERIC(3,2),
  weight_applied    NUMERIC(4,3),
  raw_llm_response  JSONB,
  model_used        TEXT,
  latency_ms        INTEGER,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (scan_id, feature_name, image_type)
);

CREATE INDEX IF NOT EXISTS idx_feature_analyses_scan ON feature_analyses(scan_id);

-- ============================================================
-- Training Scans (labeled data for weight optimization)
-- ============================================================
CREATE TABLE IF NOT EXISTS training_scans (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID REFERENCES neon_auth."user"(id) ON DELETE SET NULL,
  front_image_url   TEXT NOT NULL,
  profile_image_url TEXT NOT NULL,
  known_bf_pct      NUMERIC(4,1) NOT NULL,
  gender            TEXT CHECK (gender IN ('male', 'female', 'other')),
  height_cm         NUMERIC(5,1),
  weight_kg         NUMERIC(5,1),
  source            TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- Weight Optimization Runs (track tuning runs)
-- ============================================================
CREATE TABLE IF NOT EXISTS weight_optimization_runs (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id_produced    UUID REFERENCES analysis_configs(id),
  training_scan_count   INTEGER NOT NULL,
  mean_absolute_error   NUMERIC(5,2),
  mean_squared_error    NUMERIC(7,4),
  notes                 TEXT,
  started_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at          TIMESTAMPTZ
);
