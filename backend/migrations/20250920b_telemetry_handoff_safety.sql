BEGIN;

-- Handoff: garanta que o script anterior não quebre se os campos já existem
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='conversations' AND column_name='ai_enabled'
  ) THEN
    EXECUTE 'ALTER TABLE public.conversations ADD COLUMN ai_enabled boolean DEFAULT FALSE';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='conversations' AND column_name='ai_status'
  ) THEN
    EXECUTE 'ALTER TABLE public.conversations ADD COLUMN ai_status text DEFAULT ''idle''';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='conversations' AND column_name='human_requested_at'
  ) THEN
    EXECUTE 'ALTER TABLE public.conversations ADD COLUMN human_requested_at timestamptz';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='conversations' AND column_name='alert_sent'
  ) THEN
    EXECUTE 'ALTER TABLE public.conversations ADD COLUMN alert_sent boolean DEFAULT FALSE';
  END IF;
END $$;

-- Telemetria: se o Codex criou tabelas, ok; se não, as views continuam válidas.
-- Recrie/garanta as views sugeridas (leem de audit_logs/messages)
CREATE OR REPLACE VIEW public.vw_wa_send_events AS
SELECT
  a.org_id,
  a.action,
  a.created_at,
  COALESCE(a.meta->>'transport', a.target_type, a.action) AS transport,
  a.meta->>'idempotencyKey'           AS idempotency_key,
  a.meta->>'provider_message_id'      AS provider_message_id,
  NULLIF((a.meta->>'latency_ms')::int, NULL) AS latency_ms,
  NULLIF((a.meta->>'attempts')::int,   NULL) AS attempts,
  a.meta->>'error_code'               AS error_code
FROM public.audit_logs a
WHERE a.action IN ('wa.send.provider','wa.send.fallback');

CREATE OR REPLACE VIEW public.vw_wa_send_daily AS
SELECT
  org_id,
  date_trunc('day', created_at)::date AS day,
  LOWER(COALESCE(transport,'unknown')) AS transport,
  SUM(CASE WHEN action='wa.send.provider' THEN 1 ELSE 0 END) AS provider_ok,
  SUM(CASE WHEN action='wa.send.fallback' THEN 1 ELSE 0 END) AS provider_fallback,
  COUNT(*) AS total_attempts
FROM public.vw_wa_send_events
GROUP BY org_id, day, transport;

CREATE OR REPLACE VIEW public.vw_wa_latency_daily AS
WITH base AS (
  SELECT org_id,
         date_trunc('day', created_at)::date AS day,
         LOWER(COALESCE(transport,'unknown')) AS transport,
         latency_ms
  FROM public.vw_wa_send_events
  WHERE action='wa.send.provider' AND latency_ms IS NOT NULL
)
SELECT
  org_id, day, transport,
  percentile_cont(0.5) WITHIN GROUP (ORDER BY latency_ms) AS p50_ms,
  percentile_cont(0.95) WITHIN GROUP (ORDER BY latency_ms) AS p95_ms,
  COUNT(*) AS samples
FROM base
GROUP BY org_id, day, transport;

CREATE OR REPLACE VIEW public.vw_inbox_ttfr AS
WITH inbound AS (
  SELECT m.conversation_id, m.created_at AS t_in
  FROM public.messages m
  WHERE m.direction IN ('inbound','incoming','in')
),
outbound AS (
  SELECT m.conversation_id, m.created_at AS t_out
  FROM public.messages m
  WHERE m.direction IN ('outbound','outgoing','out')
),
pairs AS (
  SELECT i.conversation_id, i.t_in,
         (SELECT MIN(o.t_out)
          FROM outbound o
          WHERE o.conversation_id = i.conversation_id
            AND o.t_out > i.t_in) AS t_first_out
  FROM inbound i
)
SELECT
  p.conversation_id,
  p.t_in::date AS day,
  EXTRACT(EPOCH FROM (p.t_first_out - p.t_in))::int AS ttfr_seconds
FROM pairs p
WHERE p.t_first_out IS NOT NULL;

CREATE OR REPLACE VIEW public.vw_inbox_ttfr_daily AS
SELECT
  conversation_id, day, ttfr_seconds
FROM public.vw_inbox_ttfr;

CREATE OR REPLACE VIEW public.vw_inbox_volume_daily AS
SELECT
  date_trunc('day', m.created_at)::date AS day,
  SUM(CASE WHEN m.direction IN ('inbound','incoming','in')  THEN 1 ELSE 0 END) AS inbound_count,
  SUM(CASE WHEN m.direction IN ('outbound','outgoing','out') THEN 1 ELSE 0 END) AS outbound_count,
  COUNT(*) AS total
FROM public.messages m
GROUP BY day;

COMMIT;
