INSERT INTO feature_defs (code, label, type, unit, category, sort_order, is_public, show_as_tick)
VALUES ('instagram_publish_daily_quota','Instagram – Publicações por dia','number','count','social',50,true,false)
ON CONFLICT (code) DO NOTHING;

INSERT INTO plan_features (plan_id, feature_code, value)
SELECT id, 'instagram_publish_daily_quota', jsonb_build_object('enabled', true, 'limit', 10)
FROM plans
ON CONFLICT (plan_id, feature_code) DO NOTHING;
