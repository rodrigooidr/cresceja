-- 1) Colunas novas em plans
ALTER TABLE plans
  ADD COLUMN IF NOT EXISTS is_free boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS trial_days integer DEFAULT 14,              -- dias do free
  ADD COLUMN IF NOT EXISTS billing_period_months integer DEFAULT 1;    -- meses do ciclo pago

-- 2) Índice útil para expiração
CREATE INDEX IF NOT EXISTS idx_clients_active_dates
  ON clients(active, start_date, end_date);

-- 3) Tabela de consumo mensal por módulo (quota)
CREATE TABLE IF NOT EXISTS usage_counters (
  id bigserial PRIMARY KEY,
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  module_key text NOT NULL,
  period_start date NOT NULL,
  period_end date NOT NULL,
  used bigint NOT NULL DEFAULT 0,
  quota bigint,
  UNIQUE (client_id, module_key, period_start, period_end)
);

-- 4) Semeia/atualiza o plano Free
INSERT INTO plans (id, name, monthly_price, currency, modules, is_published, sort_order, is_free, trial_days, billing_period_months)
VALUES (
  'free',
  'Free',
  0,
  'BRL',
  '{
     "omnichannel": {"enabled": true,  "chat_sessions": 50},
     "crm":         {"enabled": true,  "opportunities": 50},
     "marketing":   {"enabled": false, "posts_per_month": 0},
     "approvals":   {"enabled": false},
     "ai_credits":  {"enabled": true,  "credits": 2000},
     "governance":  {"enabled": true}
   }'::jsonb,
  true,
  0,
  true,
  14,
  0
)
ON CONFLICT (id) DO UPDATE SET
  name='Free',
  monthly_price=0,
  currency='BRL',
  modules=EXCLUDED.modules,
  is_published=true,
  sort_order=0,
  is_free=true,
  trial_days=EXCLUDED.trial_days,
  billing_period_months=0;
