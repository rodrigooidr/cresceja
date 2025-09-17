BEGIN;

-- Add columns for handoff tracking (idempotent)
ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS human_requested_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS alert_sent BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS handoff_ack_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS handoff_ack_by UUID;

-- Telemetry raw events (append-only)
CREATE TABLE IF NOT EXISTS public.telemetry_events (
  id          BIGSERIAL PRIMARY KEY,
  org_id      UUID NOT NULL,
  user_id     UUID,
  source      TEXT NOT NULL,
  event_key   TEXT NOT NULL,
  value_num   NUMERIC,
  metadata    JSONB DEFAULT '{}'::jsonb,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_te_org_time ON public.telemetry_events(org_id, occurred_at);
CREATE INDEX IF NOT EXISTS idx_te_key ON public.telemetry_events(event_key);

-- Daily aggregates table (optional materialisation)
CREATE TABLE IF NOT EXISTS public.telemetry_kpis_daily (
  org_id UUID NOT NULL,
  day    DATE NOT NULL,
  metric TEXT NOT NULL,
  value  NUMERIC NOT NULL,
  PRIMARY KEY (org_id, day, metric)
);

-- Utility view (last 30 days of raw events)
CREATE OR REPLACE VIEW public.vw_telemetry_last30 AS
SELECT
  org_id,
  date_trunc('day', occurred_at)::date AS day,
  event_key,
  count(*)::int AS cnt
FROM public.telemetry_events
WHERE occurred_at >= now() - interval '30 days'
GROUP BY 1, 2, 3;

-- Recreate vw_inbox_threads preserving tag order and adding handoff helpers
DROP VIEW IF EXISTS public.vw_inbox_threads;
CREATE VIEW public.vw_inbox_threads AS
SELECT
  c.id                AS conversation_id,
  c.org_id,
  c.channel,
  ch.mode             AS transport,
  c.account_id,
  c.chat_id,
  c.contact_id,
  COALESCE(ct.display_name, ct.name, ct.phone_e164, ct.phone, c.chat_id) AS contact_name,
  c.status,
  c.ai_enabled,
  c.unread_count,
  c.last_message_at,
  COALESCE(
    (
      SELECT ARRAY_AGG(t.name ORDER BY t.name)
      FROM public.contact_tags  ctags
      JOIN public.tags          t ON t.id = ctags.tag_id
      WHERE ctags.contact_id = c.contact_id
        AND ctags.org_id    = c.org_id
        AND t.org_id        = c.org_id
    ),
    ARRAY[]::text[]
  ) AS tags,
  c.human_requested_at,
  c.alert_sent,
  (c.human_requested_at IS NOT NULL AND c.ai_enabled = FALSE) AS needs_human
FROM public.conversations c
JOIN public.channels      ch ON ch.id = c.channel_id
LEFT JOIN public.contacts ct ON ct.id = c.contact_id;

COMMIT;
