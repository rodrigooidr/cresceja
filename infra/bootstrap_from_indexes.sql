-- Bootstrap SQL generated from uploaded index list


CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE OR REPLACE FUNCTION public.util_digits(text) RETURNS text
LANGUAGE sql IMMUTABLE STRICT PARALLEL SAFE AS $$ SELECT regexp_replace($1, '\D', '', 'g') $$;


CREATE OR REPLACE FUNCTION public.util_email_lower(text) RETURNS text
LANGUAGE sql IMMUTABLE STRICT PARALLEL SAFE AS $$ SELECT lower($1) $$;


CREATE OR REPLACE FUNCTION public.util_br_e164(text) RETURNS text
LANGUAGE sql IMMUTABLE STRICT PARALLEL SAFE AS $$ 
  SELECT CASE 
    WHEN $1 IS NULL THEN NULL
    ELSE '+' || regexp_replace(regexp_replace($1, '\D', '', 'g'), '^(?!55)', '55')
  END;
$$;



-- === Minimal tables inferred from indexes ===

CREATE TABLE IF NOT EXISTS public.ai_credit_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category text,
  org_id uuid,
  period_start timestamptz,
  user_id uuid
);

CREATE TABLE IF NOT EXISTS public.ai_usage_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid()
);

CREATE TABLE IF NOT EXISTS public.appointments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid()
);

CREATE TABLE IF NOT EXISTS public.assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid()
);

CREATE TABLE IF NOT EXISTS public.attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid()
);

CREATE TABLE IF NOT EXISTS public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid()
);

CREATE TABLE IF NOT EXISTS public.calendar_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid()
);

CREATE TABLE IF NOT EXISTS public.calendar_integrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid()
);

CREATE TABLE IF NOT EXISTS public.calendar_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid()
);

CREATE TABLE IF NOT EXISTS public.calendars (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid()
);

CREATE TABLE IF NOT EXISTS public.channel_accounts (
  channel text,
  external_account_id uuid,
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid
);

CREATE TABLE IF NOT EXISTS public.channel_id_map (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_type text,
  external_id uuid,
  org_id uuid
);

CREATE TABLE IF NOT EXISTS public.channels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mode text,
  org_id uuid,
  type text
);

CREATE TABLE IF NOT EXISTS public.clients (
  NULL text,
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid
);

CREATE TABLE IF NOT EXISTS public.contact_identities (
  account_id uuid,
  channel text,
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  identity text,
  org_id uuid
);

CREATE TABLE IF NOT EXISTS public.contact_tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id uuid,
  tag_id uuid
);

CREATE TABLE IF NOT EXISTS public.contacts (
  NULL text,
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid
);

CREATE TABLE IF NOT EXISTS public.content_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid()
);

CREATE TABLE IF NOT EXISTS public.content_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid()
);

CREATE TABLE IF NOT EXISTS public.content_suggestions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid()
);

CREATE TABLE IF NOT EXISTS public.conversations (
  account_id uuid,
  channel text,
  chat_id uuid,
  external_user_id uuid,
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid,
  transport text
);

CREATE TABLE IF NOT EXISTS public.crm_opportunities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid()
);

CREATE TABLE IF NOT EXISTS public.email_automation_steps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid()
);

CREATE TABLE IF NOT EXISTS public.email_automations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid()
);

CREATE TABLE IF NOT EXISTS public.email_campaign_recipients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid()
);

CREATE TABLE IF NOT EXISTS public.email_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid()
);

CREATE TABLE IF NOT EXISTS public.email_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid()
);

CREATE TABLE IF NOT EXISTS public.email_lists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid()
);

CREATE TABLE IF NOT EXISTS public.email_segments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid()
);

CREATE TABLE IF NOT EXISTS public.email_subscriptions (
  email text,
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  list_id uuid,
  org_id uuid
);

CREATE TABLE IF NOT EXISTS public.email_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid()
);

CREATE TABLE IF NOT EXISTS public.facebook_oauth_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  page_id uuid
);

CREATE TABLE IF NOT EXISTS public.facebook_pages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid,
  page_id uuid
);

CREATE TABLE IF NOT EXISTS public.facebook_publish_jobs (
  client_dedupe_key) WHERE (status = ANY (ARRAY['pending'::text, 'creating'::text, 'publishing'::text]) text,
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid,
  page_id uuid
);

CREATE TABLE IF NOT EXISTS public.feature_defs (
  code text,
  id uuid PRIMARY KEY DEFAULT gen_random_uuid()
);

CREATE TABLE IF NOT EXISTS public.google_calendar_accounts (
  google_user_id uuid,
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid
);

CREATE TABLE IF NOT EXISTS public.google_oauth_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid()
);

CREATE TABLE IF NOT EXISTS public.import_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid()
);

CREATE TABLE IF NOT EXISTS public.instagram_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ig_user_id uuid,
  org_id uuid
);

CREATE TABLE IF NOT EXISTS public.instagram_oauth_tokens (
  account_id uuid,
  id uuid PRIMARY KEY DEFAULT gen_random_uuid()
);

CREATE TABLE IF NOT EXISTS public.instagram_publish_jobs (
  account_id uuid,
  client_dedupe_key) WHERE (status = ANY (ARRAY['pending'::text, 'creating'::text, 'publishing'::text]) text,
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid
);

CREATE TABLE IF NOT EXISTS public.invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid()
);

CREATE TABLE IF NOT EXISTS public.leads (
  NULL text,
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid
);

CREATE TABLE IF NOT EXISTS public.lgpd_consents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid()
);

CREATE TABLE IF NOT EXISTS public.lgpd_erasure_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid()
);

CREATE TABLE IF NOT EXISTS public.message_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  idx text,
  message_id uuid
);

CREATE TABLE IF NOT EXISTS public.message_status_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid()
);

CREATE TABLE IF NOT EXISTS public.message_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid()
);

CREATE TABLE IF NOT EXISTS public.message_transcripts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid()
);

CREATE TABLE IF NOT EXISTS public.messages (
  NULL text,
  external_message_id uuid,
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid,
  platform text,
  thread_id uuid
);

CREATE TABLE IF NOT EXISTS public.nps_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid()
);

CREATE TABLE IF NOT EXISTS public.nps_surveys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid()
);

CREATE TABLE IF NOT EXISTS public.onboarding_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid()
);

CREATE TABLE IF NOT EXISTS public.org_ai_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid
);

CREATE TABLE IF NOT EXISTS public.org_memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid,
  user_id uuid
);

CREATE TABLE IF NOT EXISTS public.org_tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid()
);

CREATE TABLE IF NOT EXISTS public.org_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid,
  user_id uuid
);

CREATE TABLE IF NOT EXISTS public.organization_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid
);

CREATE TABLE IF NOT EXISTS public.organizations (
  NULL text,
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text
);

CREATE TABLE IF NOT EXISTS public.orgs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid()
);

CREATE TABLE IF NOT EXISTS public.payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid()
);

CREATE TABLE IF NOT EXISTS public.plan_features (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  feature_code text,
  plan_id uuid
);

CREATE TABLE IF NOT EXISTS public.plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid()
);

CREATE TABLE IF NOT EXISTS public.posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid()
);

CREATE TABLE IF NOT EXISTS public.purchases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid()
);

CREATE TABLE IF NOT EXISTS public.repurpose_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid
);

CREATE TABLE IF NOT EXISTS public.rewards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid()
);

CREATE TABLE IF NOT EXISTS public.social_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid()
);

CREATE TABLE IF NOT EXISTS public.subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid
);

CREATE TABLE IF NOT EXISTS public.support_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid()
);

CREATE TABLE IF NOT EXISTS public.tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text,
  org_id uuid
);

CREATE TABLE IF NOT EXISTS public.templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid()
);

CREATE TABLE IF NOT EXISTS public.usage_counters (
  client_id uuid,
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  module_key text,
  period_end timestamptz,
  period_start timestamptz
);

CREATE TABLE IF NOT EXISTS public.users (
  email text,
  id uuid PRIMARY KEY DEFAULT gen_random_uuid()
);

CREATE TABLE IF NOT EXISTS public.whatsapp_channels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid,
  phone_e164 text
);

CREATE TABLE IF NOT EXISTS public.whatsapp_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid()
);


-- === Recreate indexes (idempotent) ===

DO $$BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relkind='i' AND relname='ai_credit_usage_pkey') THEN
    CREATE UNIQUE INDEX ai_credit_usage_pkey ON public.ai_credit_usage USING btree (org_id, user_id, category, period_start);
  END IF;
END$$;

DO $$BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relkind='i' AND relname='ai_usage_logs_pkey') THEN
    CREATE UNIQUE INDEX ai_usage_logs_pkey ON public.ai_usage_logs USING btree (id);
  END IF;
END$$;

DO $$BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relkind='i' AND relname='appointments_pkey') THEN
    CREATE UNIQUE INDEX appointments_pkey ON public.appointments USING btree (id);
  END IF;
END$$;

DO $$BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relkind='i' AND relname='assets_pkey') THEN
    CREATE UNIQUE INDEX assets_pkey ON public.assets USING btree (id);
  END IF;
END$$;

DO $$BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relkind='i' AND relname='attachments_pkey') THEN
    CREATE UNIQUE INDEX attachments_pkey ON public.attachments USING btree (id);
  END IF;
END$$;

DO $$BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relkind='i' AND relname='audit_logs_pkey') THEN
    CREATE UNIQUE INDEX audit_logs_pkey ON public.audit_logs USING btree (id);
  END IF;
END$$;

DO $$BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relkind='i' AND relname='calendar_events_pkey') THEN
    CREATE UNIQUE INDEX calendar_events_pkey ON public.calendar_events USING btree (id);
  END IF;
END$$;

DO $$BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relkind='i' AND relname='calendar_integrations_pkey') THEN
    CREATE UNIQUE INDEX calendar_integrations_pkey ON public.calendar_integrations USING btree (id);
  END IF;
END$$;

DO $$BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relkind='i' AND relname='calendar_members_pkey') THEN
    CREATE UNIQUE INDEX calendar_members_pkey ON public.calendar_members USING btree (id);
  END IF;
END$$;

DO $$BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relkind='i' AND relname='calendars_pkey') THEN
    CREATE UNIQUE INDEX calendars_pkey ON public.calendars USING btree (id);
  END IF;
END$$;

DO $$BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relkind='i' AND relname='channel_accounts_org_id_channel_external_account_id_key') THEN
    CREATE UNIQUE INDEX channel_accounts_org_id_channel_external_account_id_key ON public.channel_accounts USING btree (org_id, channel, external_account_id);
  END IF;
END$$;

DO $$BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relkind='i' AND relname='channel_accounts_pkey') THEN
    CREATE UNIQUE INDEX channel_accounts_pkey ON public.channel_accounts USING btree (id);
  END IF;
END$$;

DO $$BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relkind='i' AND relname='channel_id_map_pkey') THEN
    CREATE UNIQUE INDEX channel_id_map_pkey ON public.channel_id_map USING btree (org_id, channel_type, external_id);
  END IF;
END$$;

DO $$BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relkind='i' AND relname='channels_pkey') THEN
    CREATE UNIQUE INDEX channels_pkey ON public.channels USING btree (id);
  END IF;
END$$;

DO $$BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relkind='i' AND relname='idx_channels_org_type_mode') THEN
    CREATE UNIQUE INDEX idx_channels_org_type_mode ON public.channels USING btree (org_id, type, mode);
  END IF;
END$$;

DO $$BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relkind='i' AND relname='clients_pkey') THEN
    CREATE UNIQUE INDEX clients_pkey ON public.clients USING btree (id);
  END IF;
END$$;

DO $$BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relkind='i' AND relname='ux_clients_org_email_lower') THEN
    CREATE UNIQUE INDEX ux_clients_org_email_lower ON public.clients USING btree (org_id, lower(email)) WHERE (email IS NOT NULL);
  END IF;
END$$;

DO $$BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relkind='i' AND relname='contact_identities_org_id_channel_account_id_identity_key') THEN
    CREATE UNIQUE INDEX contact_identities_org_id_channel_account_id_identity_key ON public.contact_identities USING btree (org_id, channel, account_id, identity);
  END IF;
END$$;

DO $$BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relkind='i' AND relname='contact_identities_pkey') THEN
    CREATE UNIQUE INDEX contact_identities_pkey ON public.contact_identities USING btree (id);
  END IF;
END$$;

DO $$BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relkind='i' AND relname='contact_tags_pkey') THEN
    CREATE UNIQUE INDEX contact_tags_pkey ON public.contact_tags USING btree (contact_id, tag_id);
  END IF;
END$$;

DO $$BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relkind='i' AND relname='contacts_pkey') THEN
    CREATE UNIQUE INDEX contacts_pkey ON public.contacts USING btree (id);
  END IF;
END$$;

DO $$BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relkind='i' AND relname='uq_contacts_org_cpf') THEN
    CREATE UNIQUE INDEX uq_contacts_org_cpf ON public.contacts USING btree (org_id, cpf) WHERE (cpf IS NOT NULL);
  END IF;
END$$;

DO $$BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relkind='i' AND relname='ux_contacts_org_cnpj_digits') THEN
    CREATE UNIQUE INDEX ux_contacts_org_cnpj_digits ON public.contacts USING btree (org_id, util_digits(cnpj)) WHERE (cnpj IS NOT NULL);
  END IF;
END$$;

DO $$BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relkind='i' AND relname='ux_contacts_org_cpf_digits') THEN
    CREATE UNIQUE INDEX ux_contacts_org_cpf_digits ON public.contacts USING btree (org_id, util_digits(cpf)) WHERE (cpf IS NOT NULL);
  END IF;
END$$;

DO $$BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relkind='i' AND relname='ux_contacts_org_email_lower') THEN
    CREATE UNIQUE INDEX ux_contacts_org_email_lower ON public.contacts USING btree (org_id, util_email_lower(email)) WHERE (email IS NOT NULL);
  END IF;
END$$;

DO $$BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relkind='i' AND relname='ux_contacts_org_phone_e164') THEN
    CREATE UNIQUE INDEX ux_contacts_org_phone_e164 ON public.contacts USING btree (org_id, phone_e164) WHERE (phone_e164 IS NOT NULL);
  END IF;
END$$;

DO $$BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relkind='i' AND relname='content_assets_pkey') THEN
    CREATE UNIQUE INDEX content_assets_pkey ON public.content_assets USING btree (id);
  END IF;
END$$;

DO $$BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relkind='i' AND relname='content_campaigns_pkey') THEN
    CREATE UNIQUE INDEX content_campaigns_pkey ON public.content_campaigns USING btree (id);
  END IF;
END$$;

DO $$BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relkind='i' AND relname='content_suggestions_pkey') THEN
    CREATE UNIQUE INDEX content_suggestions_pkey ON public.content_suggestions USING btree (id);
  END IF;
END$$;

DO $$BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relkind='i' AND relname='conv_chat_transport_idx') THEN
    CREATE UNIQUE INDEX conv_chat_transport_idx ON public.conversations USING btree (chat_id, transport);
  END IF;
END$$;

DO $$BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relkind='i' AND relname='conversations_pkey') THEN
    CREATE UNIQUE INDEX conversations_pkey ON public.conversations USING btree (id);
  END IF;
END$$;

DO $$BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relkind='i' AND relname='uq_conversations_uniqueness') THEN
    CREATE UNIQUE INDEX uq_conversations_uniqueness ON public.conversations USING btree (org_id, channel, account_id, external_user_id);
  END IF;
END$$;

DO $$BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relkind='i' AND relname='crm_opportunities_pkey') THEN
    CREATE UNIQUE INDEX crm_opportunities_pkey ON public.crm_opportunities USING btree (id);
  END IF;
END$$;

DO $$BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relkind='i' AND relname='email_automation_steps_pkey') THEN
    CREATE UNIQUE INDEX email_automation_steps_pkey ON public.email_automation_steps USING btree (id);
  END IF;
END$$;

DO $$BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relkind='i' AND relname='email_automations_pkey') THEN
    CREATE UNIQUE INDEX email_automations_pkey ON public.email_automations USING btree (id);
  END IF;
END$$;

DO $$BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relkind='i' AND relname='email_campaign_recipients_pkey') THEN
    CREATE UNIQUE INDEX email_campaign_recipients_pkey ON public.email_campaign_recipients USING btree (id);
  END IF;
END$$;

DO $$BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relkind='i' AND relname='email_campaigns_pkey') THEN
    CREATE UNIQUE INDEX email_campaigns_pkey ON public.email_campaigns USING btree (id);
  END IF;
END$$;

DO $$BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relkind='i' AND relname='email_events_pkey') THEN
    CREATE UNIQUE INDEX email_events_pkey ON public.email_events USING btree (id);
  END IF;
END$$;

DO $$BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relkind='i' AND relname='email_lists_pkey') THEN
    CREATE UNIQUE INDEX email_lists_pkey ON public.email_lists USING btree (id);
  END IF;
END$$;

DO $$BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relkind='i' AND relname='email_segments_pkey') THEN
    CREATE UNIQUE INDEX email_segments_pkey ON public.email_segments USING btree (id);
  END IF;
END$$;

DO $$BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relkind='i' AND relname='email_subscriptions_org_id_list_id_email_key') THEN
    CREATE UNIQUE INDEX email_subscriptions_org_id_list_id_email_key ON public.email_subscriptions USING btree (org_id, list_id, email);
  END IF;
END$$;

DO $$BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relkind='i' AND relname='email_subscriptions_pkey') THEN
    CREATE UNIQUE INDEX email_subscriptions_pkey ON public.email_subscriptions USING btree (id);
  END IF;
END$$;

DO $$BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relkind='i' AND relname='email_templates_pkey') THEN
    CREATE UNIQUE INDEX email_templates_pkey ON public.email_templates USING btree (id);
  END IF;
END$$;

DO $$BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relkind='i' AND relname='facebook_oauth_tokens_page_id_key') THEN
    CREATE UNIQUE INDEX facebook_oauth_tokens_page_id_key ON public.facebook_oauth_tokens USING btree (page_id);
  END IF;
END$$;

DO $$BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relkind='i' AND relname='facebook_oauth_tokens_pkey') THEN
    CREATE UNIQUE INDEX facebook_oauth_tokens_pkey ON public.facebook_oauth_tokens USING btree (id);
  END IF;
END$$;

DO $$BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relkind='i' AND relname='facebook_pages_org_id_page_id_key') THEN
    CREATE UNIQUE INDEX facebook_pages_org_id_page_id_key ON public.facebook_pages USING btree (org_id, page_id);
  END IF;
END$$;

DO $$BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relkind='i' AND relname='facebook_pages_pkey') THEN
    CREATE UNIQUE INDEX facebook_pages_pkey ON public.facebook_pages USING btree (id);
  END IF;
END$$;

DO $$BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relkind='i' AND relname='facebook_publish_jobs_pkey') THEN
    CREATE UNIQUE INDEX facebook_publish_jobs_pkey ON public.facebook_publish_jobs USING btree (id);
  END IF;
END$$;

DO $$BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relkind='i' AND relname='ux_fb_jobs_dedupe') THEN
    CREATE UNIQUE INDEX ux_fb_jobs_dedupe ON public.facebook_publish_jobs USING btree (org_id, page_id, client_dedupe_key) WHERE (status = ANY (ARRAY['pending'::text, 'creating'::text, 'publishing'::text]));
  END IF;
END$$;

DO $$BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relkind='i' AND relname='feature_defs_code_key') THEN
    CREATE UNIQUE INDEX feature_defs_code_key ON public.feature_defs USING btree (code);
  END IF;
END$$;

DO $$BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relkind='i' AND relname='feature_defs_pkey') THEN
    CREATE UNIQUE INDEX feature_defs_pkey ON public.feature_defs USING btree (id);
  END IF;
END$$;

DO $$BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relkind='i' AND relname='google_calendar_accounts_org_id_google_user_id_key') THEN
    CREATE UNIQUE INDEX google_calendar_accounts_org_id_google_user_id_key ON public.google_calendar_accounts USING btree (org_id, google_user_id);
  END IF;
END$$;

DO $$BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relkind='i' AND relname='google_calendar_accounts_pkey') THEN
    CREATE UNIQUE INDEX google_calendar_accounts_pkey ON public.google_calendar_accounts USING btree (id);
  END IF;
END$$;

DO $$BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relkind='i' AND relname='google_oauth_tokens_pkey') THEN
    CREATE UNIQUE INDEX google_oauth_tokens_pkey ON public.google_oauth_tokens USING btree (id);
  END IF;
END$$;

DO $$BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relkind='i' AND relname='import_runs_pkey') THEN
    CREATE UNIQUE INDEX import_runs_pkey ON public.import_runs USING btree (id);
  END IF;
END$$;

DO $$BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relkind='i' AND relname='instagram_accounts_org_id_ig_user_id_key') THEN
    CREATE UNIQUE INDEX instagram_accounts_org_id_ig_user_id_key ON public.instagram_accounts USING btree (org_id, ig_user_id);
  END IF;
END$$;

DO $$BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relkind='i' AND relname='instagram_accounts_pkey') THEN
    CREATE UNIQUE INDEX instagram_accounts_pkey ON public.instagram_accounts USING btree (id);
  END IF;
END$$;

DO $$BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relkind='i' AND relname='instagram_oauth_tokens_account_id_key') THEN
    CREATE UNIQUE INDEX instagram_oauth_tokens_account_id_key ON public.instagram_oauth_tokens USING btree (account_id);
  END IF;
END$$;

DO $$BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relkind='i' AND relname='instagram_oauth_tokens_pkey') THEN
    CREATE UNIQUE INDEX instagram_oauth_tokens_pkey ON public.instagram_oauth_tokens USING btree (id);
  END IF;
END$$;

DO $$BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relkind='i' AND relname='instagram_publish_jobs_pkey') THEN
    CREATE UNIQUE INDEX instagram_publish_jobs_pkey ON public.instagram_publish_jobs USING btree (id);
  END IF;
END$$;

DO $$BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relkind='i' AND relname='ux_ig_jobs_dedupe') THEN
    CREATE UNIQUE INDEX ux_ig_jobs_dedupe ON public.instagram_publish_jobs USING btree (org_id, account_id, client_dedupe_key) WHERE (status = ANY (ARRAY['pending'::text, 'creating'::text, 'publishing'::text]));
  END IF;
END$$;

DO $$BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relkind='i' AND relname='invoices_pkey') THEN
    CREATE UNIQUE INDEX invoices_pkey ON public.invoices USING btree (id);
  END IF;
END$$;

DO $$BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relkind='i' AND relname='leads_pkey') THEN
    CREATE UNIQUE INDEX leads_pkey ON public.leads USING btree (id);
  END IF;
END$$;

DO $$BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relkind='i' AND relname='ux_leads_email') THEN
    CREATE UNIQUE INDEX ux_leads_email ON public.leads USING btree (org_id, email) WHERE (email IS NOT NULL);
  END IF;
END$$;

DO $$BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relkind='i' AND relname='ux_leads_phone') THEN
    CREATE UNIQUE INDEX ux_leads_phone ON public.leads USING btree (org_id, phone) WHERE (phone IS NOT NULL);
  END IF;
END$$;

DO $$BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relkind='i' AND relname='lgpd_consents_pkey') THEN
    CREATE UNIQUE INDEX lgpd_consents_pkey ON public.lgpd_consents USING btree (id);
  END IF;
END$$;

DO $$BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relkind='i' AND relname='lgpd_erasure_requests_pkey') THEN
    CREATE UNIQUE INDEX lgpd_erasure_requests_pkey ON public.lgpd_erasure_requests USING btree (id);
  END IF;
END$$;

DO $$BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relkind='i' AND relname='message_attachments_pkey') THEN
    CREATE UNIQUE INDEX message_attachments_pkey ON public.message_attachments USING btree (id);
  END IF;
END$$;

DO $$BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relkind='i' AND relname='uq_ma_message_idx') THEN
    CREATE UNIQUE INDEX uq_ma_message_idx ON public.message_attachments USING btree (message_id, idx);
  END IF;
END$$;

DO $$BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relkind='i' AND relname='message_status_events_pkey') THEN
    CREATE UNIQUE INDEX message_status_events_pkey ON public.message_status_events USING btree (id);
  END IF;
END$$;

DO $$BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relkind='i' AND relname='message_templates_pkey') THEN
    CREATE UNIQUE INDEX message_templates_pkey ON public.message_templates USING btree (id);
  END IF;
END$$;

DO $$BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relkind='i' AND relname='message_transcripts_pkey') THEN
    CREATE UNIQUE INDEX message_transcripts_pkey ON public.message_transcripts USING btree (id);
  END IF;
END$$;

DO $$BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relkind='i' AND relname='messages_pkey') THEN
    CREATE UNIQUE INDEX messages_pkey ON public.messages USING btree (id);
  END IF;
END$$;

DO $$BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relkind='i' AND relname='msg_provider_unique') THEN
    CREATE UNIQUE INDEX msg_provider_unique ON public.messages USING btree (provider_msg_id) WHERE (provider_msg_id IS NOT NULL);
  END IF;
END$$;

DO $$BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relkind='i' AND relname='uq_messages_external') THEN
    CREATE UNIQUE INDEX uq_messages_external ON public.messages USING btree (org_id, external_message_id);
  END IF;
END$$;

DO $$BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relkind='i' AND relname='uq_messages_platform_thread_msg') THEN
    CREATE UNIQUE INDEX uq_messages_platform_thread_msg ON public.messages USING btree (platform, thread_id, external_message_id);
  END IF;
END$$;

DO $$BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relkind='i' AND relname='nps_responses_pkey') THEN
    CREATE UNIQUE INDEX nps_responses_pkey ON public.nps_responses USING btree (id);
  END IF;
END$$;

DO $$BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relkind='i' AND relname='nps_surveys_pkey') THEN
    CREATE UNIQUE INDEX nps_surveys_pkey ON public.nps_surveys USING btree (id);
  END IF;
END$$;

DO $$BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relkind='i' AND relname='onboarding_tasks_pkey') THEN
    CREATE UNIQUE INDEX onboarding_tasks_pkey ON public.onboarding_tasks USING btree (id);
  END IF;
END$$;

DO $$BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relkind='i' AND relname='org_ai_settings_pkey') THEN
    CREATE UNIQUE INDEX org_ai_settings_pkey ON public.org_ai_settings USING btree (org_id);
  END IF;
END$$;

DO $$BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relkind='i' AND relname='uq_org_ai_settings_org') THEN
    CREATE UNIQUE INDEX uq_org_ai_settings_org ON public.org_ai_settings USING btree (org_id);
  END IF;
END$$;

DO $$BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relkind='i' AND relname='org_memberships_pkey') THEN
    CREATE UNIQUE INDEX org_memberships_pkey ON public.org_memberships USING btree (org_id, user_id);
  END IF;
END$$;

DO $$BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relkind='i' AND relname='org_tags_pkey') THEN
    CREATE UNIQUE INDEX org_tags_pkey ON public.org_tags USING btree (id);
  END IF;
END$$;

DO $$BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relkind='i' AND relname='org_users_pkey') THEN
    CREATE UNIQUE INDEX org_users_pkey ON public.org_users USING btree (org_id, user_id);
  END IF;
END$$;

DO $$BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relkind='i' AND relname='organization_settings_pkey') THEN
    CREATE UNIQUE INDEX organization_settings_pkey ON public.organization_settings USING btree (org_id);
  END IF;
END$$;

DO $$BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relkind='i' AND relname='organizations_pkey') THEN
    CREATE UNIQUE INDEX organizations_pkey ON public.organizations USING btree (id);
  END IF;
END$$;

DO $$BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relkind='i' AND relname='organizations_slug_key') THEN
    CREATE UNIQUE INDEX organizations_slug_key ON public.organizations USING btree (slug);
  END IF;
END$$;

DO $$BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relkind='i' AND relname='ux_organizations_document_digits') THEN
    CREATE UNIQUE INDEX ux_organizations_document_digits ON public.organizations USING btree (util_digits(document_value)) WHERE (document_value IS NOT NULL);
  END IF;
END$$;

DO $$BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relkind='i' AND relname='ux_organizations_email_lower') THEN
    CREATE UNIQUE INDEX ux_organizations_email_lower ON public.organizations USING btree (util_email_lower(email)) WHERE (email IS NOT NULL);
  END IF;
END$$;

DO $$BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relkind='i' AND relname='ux_organizations_phone_e164') THEN
    CREATE UNIQUE INDEX ux_organizations_phone_e164 ON public.organizations USING btree (util_br_e164(phone)) WHERE (phone IS NOT NULL);
  END IF;
END$$;

DO $$BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relkind='i' AND relname='ux_organizations_slug') THEN
    CREATE UNIQUE INDEX ux_organizations_slug ON public.organizations USING btree (slug);
  END IF;
END$$;

DO $$BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relkind='i' AND relname='ux_orgs_cnpj_digits') THEN
    CREATE UNIQUE INDEX ux_orgs_cnpj_digits ON public.organizations USING btree (util_digits(cnpj)) WHERE (cnpj IS NOT NULL);
  END IF;
END$$;

DO $$BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relkind='i' AND relname='ux_orgs_email_lower') THEN
    CREATE UNIQUE INDEX ux_orgs_email_lower ON public.organizations USING btree (util_email_lower(email)) WHERE (email IS NOT NULL);
  END IF;
END$$;

DO $$BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relkind='i' AND relname='ux_orgs_phone_e164') THEN
    CREATE UNIQUE INDEX ux_orgs_phone_e164 ON public.organizations USING btree (phone_e164) WHERE (phone_e164 IS NOT NULL);
  END IF;
END$$;

DO $$BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relkind='i' AND relname='orgs_pkey') THEN
    CREATE UNIQUE INDEX orgs_pkey ON public.orgs USING btree (id);
  END IF;
END$$;

DO $$BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relkind='i' AND relname='payments_pkey') THEN
    CREATE UNIQUE INDEX payments_pkey ON public.payments USING btree (id);
  END IF;
END$$;

DO $$BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relkind='i' AND relname='plan_features_pkey') THEN
    CREATE UNIQUE INDEX plan_features_pkey ON public.plan_features USING btree (plan_id, feature_code);
  END IF;
END$$;

DO $$BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relkind='i' AND relname='ux_plan_features') THEN
    CREATE UNIQUE INDEX ux_plan_features ON public.plan_features USING btree (plan_id, feature_code);
  END IF;
END$$;

DO $$BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relkind='i' AND relname='ux_plan_features_plan_code') THEN
    CREATE UNIQUE INDEX ux_plan_features_plan_code ON public.plan_features USING btree (plan_id, feature_code);
  END IF;
END$$;

DO $$BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relkind='i' AND relname='plans_pkey') THEN
    CREATE UNIQUE INDEX plans_pkey ON public.plans USING btree (id);
  END IF;
END$$;

DO $$BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relkind='i' AND relname='posts_pkey') THEN
    CREATE UNIQUE INDEX posts_pkey ON public.posts USING btree (id);
  END IF;
END$$;

DO $$BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relkind='i' AND relname='purchases_pkey') THEN
    CREATE UNIQUE INDEX purchases_pkey ON public.purchases USING btree (id);
  END IF;
END$$;

DO $$BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relkind='i' AND relname='repurpose_jobs_pkey') THEN
    CREATE UNIQUE INDEX repurpose_jobs_pkey ON public.repurpose_jobs USING btree (post_id);
  END IF;
END$$;

DO $$BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relkind='i' AND relname='rewards_pkey') THEN
    CREATE UNIQUE INDEX rewards_pkey ON public.rewards USING btree (id);
  END IF;
END$$;

DO $$BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relkind='i' AND relname='social_posts_pkey') THEN
    CREATE UNIQUE INDEX social_posts_pkey ON public.social_posts USING btree (id);
  END IF;
END$$;

DO $$BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relkind='i' AND relname='subscriptions_org_id_key') THEN
    CREATE UNIQUE INDEX subscriptions_org_id_key ON public.subscriptions USING btree (org_id);
  END IF;
END$$;

DO $$BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relkind='i' AND relname='subscriptions_pkey') THEN
    CREATE UNIQUE INDEX subscriptions_pkey ON public.subscriptions USING btree (id);
  END IF;
END$$;

DO $$BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relkind='i' AND relname='support_audit_logs_pkey') THEN
    CREATE UNIQUE INDEX support_audit_logs_pkey ON public.support_audit_logs USING btree (id);
  END IF;
END$$;

DO $$BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relkind='i' AND relname='tags_pkey') THEN
    CREATE UNIQUE INDEX tags_pkey ON public.tags USING btree (id);
  END IF;
END$$;

DO $$BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relkind='i' AND relname='ux_tags_org_lower_name') THEN
    CREATE UNIQUE INDEX ux_tags_org_lower_name ON public.tags USING btree (org_id, lower(name));
  END IF;
END$$;

DO $$BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relkind='i' AND relname='templates_pkey') THEN
    CREATE UNIQUE INDEX templates_pkey ON public.templates USING btree (id);
  END IF;
END$$;

DO $$BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relkind='i' AND relname='usage_counters_client_id_module_key_period_start_period_end_key') THEN
    CREATE UNIQUE INDEX usage_counters_client_id_module_key_period_start_period_end_key ON public.usage_counters USING btree (client_id, module_key, period_start, period_end);
  END IF;
END$$;

DO $$BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relkind='i' AND relname='usage_counters_pkey') THEN
    CREATE UNIQUE INDEX usage_counters_pkey ON public.usage_counters USING btree (id);
  END IF;
END$$;

DO $$BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relkind='i' AND relname='idx_users_email') THEN
    CREATE UNIQUE INDEX idx_users_email ON public.users USING btree (email);
  END IF;
END$$;

DO $$BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relkind='i' AND relname='users_email_key') THEN
    CREATE UNIQUE INDEX users_email_key ON public.users USING btree (email);
  END IF;
END$$;

DO $$BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relkind='i' AND relname='users_pkey') THEN
    CREATE UNIQUE INDEX users_pkey ON public.users USING btree (id);
  END IF;
END$$;

DO $$BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relkind='i' AND relname='whatsapp_channels_org_id_id_key') THEN
    CREATE UNIQUE INDEX whatsapp_channels_org_id_id_key ON public.whatsapp_channels USING btree (org_id, id);
  END IF;
END$$;

DO $$BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relkind='i' AND relname='whatsapp_channels_org_id_phone_e164_key') THEN
    CREATE UNIQUE INDEX whatsapp_channels_org_id_phone_e164_key ON public.whatsapp_channels USING btree (org_id, phone_e164);
  END IF;
END$$;

DO $$BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relkind='i' AND relname='whatsapp_channels_pkey') THEN
    CREATE UNIQUE INDEX whatsapp_channels_pkey ON public.whatsapp_channels USING btree (id);
  END IF;
END$$;

DO $$BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relkind='i' AND relname='whatsapp_templates_pkey') THEN
    CREATE UNIQUE INDEX whatsapp_templates_pkey ON public.whatsapp_templates USING btree (id);
  END IF;
END$$;





-- === Rich schema adjustments for commonly used tables ===
-- USERS
DO $$BEGIN
  IF to_regclass('public.users') IS NULL THEN
    RAISE EXCEPTION 'public.users should exist at this point';
  END IF;
END$$;

ALTER TABLE public.users
  ALTER COLUMN email TYPE text,
  ALTER COLUMN email DROP NOT NULL,
  ALTER COLUMN email SET NOT NULL;

-- ensure columns exist
DO $$BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='users' AND column_name='password_hash') THEN
    ALTER TABLE public.users ADD COLUMN password_hash text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='users' AND column_name='name') THEN
    ALTER TABLE public.users ADD COLUMN name text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='users' AND column_name='is_active') THEN
    ALTER TABLE public.users ADD COLUMN is_active boolean NOT NULL DEFAULT true;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='users' AND column_name='created_at') THEN
    ALTER TABLE public.users ADD COLUMN created_at timestamptz NOT NULL DEFAULT now();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='users' AND column_name='updated_at') THEN
    ALTER TABLE public.users ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='users' AND column_name='last_login_at') THEN
    ALTER TABLE public.users ADD COLUMN last_login_at timestamptz;
  END IF;
END$$;

-- MESSAGES
DO $$BEGIN
  IF to_regclass('public.messages') IS NULL THEN
    -- If messages wasn't in minimal set (unlikely), create it richer now
    CREATE TABLE public.messages (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      org_id uuid,
      conversation_id uuid,
      channel text NOT NULL,
      direction text NOT NULL,
      external_message_id text,
      sender_id uuid,
      sender_name text,
      sender_role text,
      content text,
      content_type text DEFAULT 'text',
      attachments jsonb NOT NULL DEFAULT '[]',
      meta jsonb NOT NULL DEFAULT '{}',
      status text NOT NULL DEFAULT 'queued',
      error text,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      sent_at timestamptz,
      delivered_at timestamptz,
      read_at timestamptz
    );
  END IF;
END$$;

DO $$BEGIN
  IF to_regclass('public.messages') IS NOT NULL THEN
    -- Ensure required columns exist
    PERFORM 1;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='messages' AND column_name='org_id') THEN
      ALTER TABLE public.messages ADD COLUMN org_id uuid;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='messages' AND column_name='conversation_id') THEN
      ALTER TABLE public.messages ADD COLUMN conversation_id uuid;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='messages' AND column_name='channel') THEN
      ALTER TABLE public.messages ADD COLUMN channel text NOT NULL DEFAULT 'whatsapp';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='messages' AND column_name='direction') THEN
      ALTER TABLE public.messages ADD COLUMN direction text NOT NULL DEFAULT 'in';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='messages' AND column_name='status') THEN
      ALTER TABLE public.messages ADD COLUMN status text NOT NULL DEFAULT 'queued';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='messages' AND column_name='attachments') THEN
      ALTER TABLE public.messages ADD COLUMN attachments jsonb NOT NULL DEFAULT '[]';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='messages' AND column_name='meta') THEN
      ALTER TABLE public.messages ADD COLUMN meta jsonb NOT NULL DEFAULT '{}';
    END IF;
  END IF;
END$$;

-- Direction/status checks
DO $$BEGIN
  IF to_regclass('public.messages') IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='messages_direction_check' AND conrelid=to_regclass('public.messages')) THEN
      ALTER TABLE public.messages ADD CONSTRAINT messages_direction_check CHECK (direction IN ('in','out'));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='messages_status_check' AND conrelid=to_regclass('public.messages')) THEN
      ALTER TABLE public.messages ADD CONSTRAINT messages_status_check CHECK (status IN ('queued','sent','delivered','read','failed','received'));
    END IF;
  END IF;
END$$;
