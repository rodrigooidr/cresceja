CREATE UNIQUE INDEX IF NOT EXISTS ux_plan_features_plan_code
  ON plan_features(plan_id, feature_code);
