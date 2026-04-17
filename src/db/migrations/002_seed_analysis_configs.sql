-- 002_seed_analysis_configs.sql
-- Default analysis configs and feature weights for male and female.

-- Male config
INSERT INTO analysis_configs (id, name, description, gender_target, is_active)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'default-male-v1',
  'Default male body-fat analysis weights',
  'male',
  true
) ON CONFLICT (id) DO NOTHING;

INSERT INTO feature_weights (config_id, feature_name, weight) VALUES
  ('00000000-0000-0000-0000-000000000001', 'belly',    0.250),
  ('00000000-0000-0000-0000-000000000001', 'waist',    0.200),
  ('00000000-0000-0000-0000-000000000001', 'chest',    0.150),
  ('00000000-0000-0000-0000-000000000001', 'neck',     0.100),
  ('00000000-0000-0000-0000-000000000001', 'triceps',  0.100),
  ('00000000-0000-0000-0000-000000000001', 'hips',     0.100),
  ('00000000-0000-0000-0000-000000000001', 'jawline',  0.050),
  ('00000000-0000-0000-0000-000000000001', 'forearms', 0.050)
ON CONFLICT (config_id, feature_name) DO NOTHING;

-- Female config
INSERT INTO analysis_configs (id, name, description, gender_target, is_active)
VALUES (
  '00000000-0000-0000-0000-000000000002',
  'default-female-v1',
  'Default female body-fat analysis weights',
  'female',
  true
) ON CONFLICT (id) DO NOTHING;

INSERT INTO feature_weights (config_id, feature_name, weight) VALUES
  ('00000000-0000-0000-0000-000000000002', 'belly',    0.200),
  ('00000000-0000-0000-0000-000000000002', 'hips',     0.200),
  ('00000000-0000-0000-0000-000000000002', 'waist',    0.200),
  ('00000000-0000-0000-0000-000000000002', 'chest',    0.150),
  ('00000000-0000-0000-0000-000000000002', 'triceps',  0.100),
  ('00000000-0000-0000-0000-000000000002', 'neck',     0.050),
  ('00000000-0000-0000-0000-000000000002', 'jawline',  0.050),
  ('00000000-0000-0000-0000-000000000002', 'forearms', 0.050)
ON CONFLICT (config_id, feature_name) DO NOTHING;
