BEGIN;

CREATE OR REPLACE VIEW public.vw_inbox_threads AS
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
  ) AS tags
FROM public.conversations c
JOIN public.channels      ch ON ch.id = c.channel_id
LEFT JOIN public.contacts ct ON ct.id = c.contact_id;

COMMIT;
