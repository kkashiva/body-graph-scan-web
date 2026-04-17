-- 003_phase5_training.sql
-- Phase 5: ML weight refinement.
-- Adds:
--   1. user_profiles.is_admin           — gates /admin/* routes
--   2. training_scans.scan_id/scored_at — links labeled images to a real
--      scans row whose feature_analyses we can re-aggregate against
--   3. weight_optimization_runs columns — snapshot of each optimizer run
--      (gender, baseline MSE, final weight vector, iteration count)

-- 1. Admin flag (toggled manually in Neon Studio)
ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT false;

-- 2. Link a training_scan to the synthetic scans row used for scoring
ALTER TABLE training_scans
  ADD COLUMN IF NOT EXISTS scan_id   UUID REFERENCES scans(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS scored_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_training_scans_unscored
  ON training_scans(created_at) WHERE scan_id IS NULL;

-- 3. Optimizer run snapshot
ALTER TABLE weight_optimization_runs
  ADD COLUMN IF NOT EXISTS gender_target TEXT
    CHECK (gender_target IN ('male','female')),
  ADD COLUMN IF NOT EXISTS baseline_mse  NUMERIC(7,4),
  ADD COLUMN IF NOT EXISTS final_weights JSONB,
  ADD COLUMN IF NOT EXISTS iterations    INTEGER;
