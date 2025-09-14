INSERT INTO feature_defs (code, label, type, unit, category, sort_order, is_public)
VALUES ('facebook_publish_daily_quota','Facebook – Publicações por dia','number','count','social',33,true)
ON CONFLICT (code) DO UPDATE SET label=EXCLUDED.label, type=EXCLUDED.type, unit=EXCLUDED.unit,
  category=EXCLUDED.category, sort_order=EXCLUDED.sort_order, is_public=EXCLUDED.is_public;

WITH data(plan_name, feature_code, val) AS (
  VALUES
  ('Free','facebook_publish_daily_quota','{"enabled": true, "limit": 1}'),
  ('Starter','facebook_publish_daily_quota','{"enabled": true, "limit": 5}'),
  ('Pro','facebook_publish_daily_quota','{"enabled": true, "limit": 20}')
)
INSERT INTO plan_features (plan_id, feature_code, value)
SELECT p.id, d.feature_code, d.val::jsonb
FROM data d JOIN plans p ON p.name ILIKE d.plan_name
ON CONFLICT (plan_id, feature_code) DO UPDATE SET value=EXCLUDED.value, updated_at=now();
