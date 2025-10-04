-- == INFERRED DDL (heuristic) ==
SET client_min_messages = WARNING;

SET search_path = public, pg_catalog;

CREATE EXTENSION IF NOT EXISTS plpgsql;

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE EXTENSION IF NOT EXISTS citext;

CREATE TABLE IF NOT EXISTS "calendars" (
  "color" text,
  "created_at" timestamptz DEFAULT now(),
  "id" uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  "kind" text,
  "name" text,
  "org_id" uuid,
  "updated_at" timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "calendar_members" (
  "PRIMARY" text,
  "calendar_id" uuid,
  "created_at" timestamptz DEFAULT now(),
  "id" uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  "org_id" uuid,
  "role" text,
  "updated_at" timestamptz DEFAULT now(),
  "user_id" uuid
);

CREATE TABLE IF NOT EXISTS "calendar_events" (
  "attendeeId" text,
  "attendee_id" uuid,
  "calendarId" text,
  "calendar_external_id" uuid,
  "calendar_id" uuid,
  "calendar_provider_id" uuid,
  "canceled_at" text,
  "clientName" text,
  "client_name" text,
  "confirmed_at" text,
  "contact_id" uuid,
  "created_at" timestamptz DEFAULT now(),
  "description" text,
  "endAt" text,
  "end_at" text,
  "external_event_id" uuid,
  "id" uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  "noshow_at" text,
  "opportunity_id" uuid,
  "org_id" uuid,
  "post_id" uuid,
  "provider" text,
  "reminder_sent" boolean DEFAULT false,
  "reminder_sent_at" timestamptz DEFAULT now(),
  "reminders_count" integer,
  "rsvp_status" text,
  "rsvp_token" text,
  "scheduled_at" timestamptz DEFAULT now(),
  "service_name" text,
  "startAt" text,
  "start_at" text,
  "status" text,
  "summary" text,
  "title" text,
  "type" text,
  "updated_at" timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "subscriptions" (
  "created_at" timestamptz DEFAULT now(),
  "current_period_end" text,
  "current_period_start" text,
  "id" uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  "org_id" uuid,
  "plan" text,
  "plan_id" uuid,
  "provider" text,
  "provider_subscription_id" uuid,
  "status" text,
  "updated_at" timestamptz DEFAULT now(),
  "user_id" uuid
);

CREATE TABLE IF NOT EXISTS "invoices" (
  "amount_cents" integer,
  "created_at" timestamptz DEFAULT now(),
  "currency" text,
  "due_date" date,
  "id" uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  "meta" text,
  "org_id" uuid,
  "paid_at" timestamptz DEFAULT now(),
  "status" text,
  "subscription_id" uuid,
  "updated_at" timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "organizations" (
  "bairro" text,
  "cep" text,
  "cidade" text,
  "cnpj" text,
  "complemento" text,
  "country" text,
  "created_at" timestamptz DEFAULT now(),
  "document_type" text,
  "document_value" text,
  "email" citext,
  "id" uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  "ie" text,
  "ie_isento" text,
  "logradouro" text,
  "meta" text,
  "name" text,
  "nome_fantasia" text,
  "numero" text,
  "phone" text,
  "phone_e164" text,
  "photo_url" text,
  "plan_id" uuid,
  "razao_social" text,
  "resp_cpf" text,
  "resp_email" citext,
  "resp_nome" text,
  "resp_phone_e164" text,
  "site" text,
  "slug" text,
  "status" text,
  "trial_ends_at" text,
  "uf" text,
  "updated_at" timestamptz DEFAULT now(),
  "whatsapp_baileys_enabled" boolean DEFAULT false,
  "whatsapp_baileys_phone" text,
  "whatsapp_baileys_session_id" uuid,
  "whatsapp_baileys_status" text,
  "whatsapp_mode" text
);

CREATE TABLE IF NOT EXISTS "audit_logs" (
  "action" text,
  "created_at" timestamptz DEFAULT now(),
  "entity" text,
  "entity_id" uuid,
  "id" uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  "meta" text,
  "org_id" uuid,
  "payload" text,
  "updated_at" timestamptz DEFAULT now(),
  "user_email" citext,
  "user_id" uuid
);

CREATE TABLE IF NOT EXISTS "posts" (
  "approved_by" text,
  "body" text,
  "channel" text,
  "content" text,
  "created_at" timestamptz DEFAULT now(),
  "created_by" text,
  "id" uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  "media" text,
  "metadata" text,
  "org_id" uuid,
  "postId" text,
  "published_at" timestamptz DEFAULT now(),
  "scheduled_at" timestamptz DEFAULT now(),
  "status" text,
  "title" text,
  "updated_at" timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "channels" (
  "UNIQUE" text,
  "config" text,
  "created_at" timestamptz DEFAULT now(),
  "credentials_json" jsonb DEFAULT '{}'::jsonb,
  "id" uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  "kind" text,
  "mode" text,
  "name" text,
  "org_id" uuid,
  "provider" text,
  "secrets" text,
  "status" text,
  "type" text,
  "updated_at" timestamptz DEFAULT now(),
  "webhook_secret" text
);

CREATE TABLE IF NOT EXISTS "content_assets" (
  "created_at" timestamptz DEFAULT now(),
  "created_by" text,
  "height" text,
  "id" uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  "meta_json" jsonb DEFAULT '{}'::jsonb,
  "mime" text,
  "org_id" uuid,
  "updated_at" timestamptz DEFAULT now(),
  "url" text,
  "width" text
);

CREATE TABLE IF NOT EXISTS "nps_surveys" (
  "client_id" uuid,
  "created_at" timestamptz DEFAULT now(),
  "id" uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  "org_id" uuid,
  "sent_at" timestamptz DEFAULT now(),
  "title" text,
  "updated_at" timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "nps_responses" (
  "client_id" uuid,
  "comment" text,
  "created_at" timestamptz DEFAULT now(),
  "id" uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  "responded_at" text,
  "score" text,
  "survey_id" uuid,
  "updated_at" timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "rewards" (
  "client_id" uuid,
  "created_at" timestamptz DEFAULT now(),
  "expires_at" text,
  "id" uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  "org_id" uuid,
  "type" text,
  "updated_at" timestamptz DEFAULT now(),
  "value" text
);

CREATE TABLE IF NOT EXISTS "messages" (
  "UNIQUE" text,
  "attachments" text,
  "attachments_json" jsonb DEFAULT '{}'::jsonb,
  "author_id" uuid,
  "body" text,
  "content" text,
  "conversation_id" uuid,
  "created_at" timestamptz DEFAULT now(),
  "direction" text,
  "emojis_json" jsonb DEFAULT '{}'::jsonb,
  "external_message_id" uuid,
  "from" text,
  "id" uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  "lead_id" uuid,
  "messageId" text,
  "meta" text,
  "org_id" uuid,
  "platform" text,
  "provider" text,
  "provider_message_id" uuid,
  "raw_json" jsonb DEFAULT '{}'::jsonb,
  "sender" text,
  "sender_type" text,
  "sender_user_id" uuid,
  "sent_at" timestamptz DEFAULT now(),
  "status" text,
  "text" text,
  "thread_id" uuid,
  "transcript" text,
  "type" text,
  "updated_at" timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "message_attachments" (
  "UNIQUE" text,
  "asset_id" uuid,
  "checksum_sha256" text,
  "created_at" timestamptz DEFAULT now(),
  "duration_ms" integer,
  "file_name" text,
  "height" text,
  "id" uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  "idx" text,
  "kind" text,
  "message_id" uuid,
  "mime" text,
  "name" text,
  "org_id" uuid,
  "path_or_key" text,
  "poster_key" text,
  "size_bytes" integer,
  "storage_provider" text,
  "thumbnail_key" text,
  "updated_at" timestamptz DEFAULT now(),
  "width" text
);

CREATE TABLE IF NOT EXISTS "conversations" (
  "UNIQUE" text,
  "account_id" uuid,
  "ai_enabled" boolean DEFAULT false,
  "ai_status" text,
  "alert_sent" boolean DEFAULT false,
  "assigned_to" text,
  "canal" text,
  "channel" text,
  "channel_id" uuid,
  "channel_type" text,
  "chat_id" uuid,
  "client_id" uuid,
  "contact_id" uuid,
  "created_at" timestamptz DEFAULT now(),
  "external_thread_id" uuid,
  "external_user_id" uuid,
  "handoff_ack_at" text,
  "handoff_ack_by" text,
  "human_requested_at" text,
  "id" uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  "is_ai_active" boolean DEFAULT false,
  "last_message_at" text,
  "lead_id" uuid,
  "orgId" text,
  "org_id" uuid,
  "resolvido" text,
  "status" text,
  "transport" text,
  "unread_count" integer,
  "updated_at" timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "message_transcripts" (
  "created_at" timestamptz DEFAULT now(),
  "id" uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  "language" text,
  "message_id" uuid,
  "org_id" uuid,
  "provider" text,
  "text" text,
  "updated_at" timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "message_templates" (
  "body" text,
  "channel_scope" text,
  "created_at" timestamptz DEFAULT now(),
  "id" uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  "language" text,
  "meta" text,
  "name" text,
  "org_id" uuid,
  "type" text,
  "updated_at" timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "leads" (
  "company_id" uuid,
  "consent" text,
  "created_at" timestamptz DEFAULT now(),
  "email" citext,
  "erased_at" timestamptz DEFAULT now(),
  "id" uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  "name" text,
  "nome" text,
  "notes" text,
  "org_id" uuid,
  "origem" text,
  "phone" text,
  "phone_e164" text,
  "responsavel" text,
  "score" text,
  "source_channel" text,
  "status" text,
  "tagsArr" text,
  "telefone" text,
  "updated_at" timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "opportunities" (
  "cliente" text,
  "created_at" timestamptz DEFAULT now(),
  "id" uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  "lead_id" uuid,
  "org_id" uuid,
  "responsavel" text,
  "sem" text,
  "status" text,
  "updated_at" timestamptz DEFAULT now(),
  "valor_estimado" text
);

CREATE TABLE IF NOT EXISTS "email_lists" (
  "created_at" timestamptz DEFAULT now(),
  "description" text,
  "id" uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  "name" text,
  "org_id" uuid,
  "updated_at" timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "email_templates" (
  "body" text,
  "created_at" timestamptz DEFAULT now(),
  "id" uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  "name" text,
  "org_id" uuid,
  "subject" text,
  "updated_at" timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "email_campaigns" (
  "created_at" timestamptz DEFAULT now(),
  "id" uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  "list_id" uuid,
  "name" text,
  "org_id" uuid,
  "scheduled_at" timestamptz DEFAULT now(),
  "status" text,
  "template_id" uuid,
  "updated_at" timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "email_campaign_recipients" (
  "campaign_id" uuid,
  "created_at" timestamptz DEFAULT now(),
  "email" citext,
  "id" uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  "org_id" uuid,
  "recipientId" text,
  "sent_at" timestamptz DEFAULT now(),
  "status" text,
  "subscription_id" uuid,
  "updated_at" timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "email_automations" (
  "created_at" timestamptz DEFAULT now(),
  "id" uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  "name" text,
  "org_id" uuid,
  "segment_id" uuid,
  "status" text,
  "template_id" uuid,
  "type" text,
  "updated_at" timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "email_subscriptions" (
  "contact_id" uuid,
  "created_at" timestamptz DEFAULT now(),
  "email" citext,
  "id" uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  "list_id" uuid,
  "org_id" uuid,
  "status" text,
  "updated_at" timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "org_features" (
  "created_at" timestamptz DEFAULT now(),
  "features" text,
  "id" uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  "org_id" uuid,
  "updated_at" timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "users" (
  "company_id" uuid,
  "created_at" timestamptz DEFAULT now(),
  "email" citext,
  "id" uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  "is_owner" boolean DEFAULT false,
  "is_superadmin" boolean DEFAULT false,
  "is_support" boolean DEFAULT false,
  "last_login_at" text,
  "name" text,
  "org_id" uuid,
  "password_hash" text,
  "perms" text,
  "role" text,
  "roles" text,
  "support_scopes" text,
  "updated_at" timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "companies" (
  "created_at" timestamptz DEFAULT now(),
  "id" uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  "name" text,
  "plan" text,
  "updated_at" timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "plans" (
  "ai_tokens_limit" text,
  "billing_period_months" text,
  "code" text,
  "created_at" timestamptz DEFAULT now(),
  "currency" text,
  "description" text,
  "id" uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  "id_legacy_text" text,
  "id_uuid" text,
  "is_active" boolean DEFAULT false,
  "is_free" boolean DEFAULT false,
  "is_published" boolean DEFAULT false,
  "modules" text,
  "monthly_price" numeric,
  "name" text,
  "price_cents" integer,
  "sort_order" text,
  "trial_days" text,
  "updated_at" timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "org_memberships" (
  "CONSTRAINT" text,
  "PRIMARY" text,
  "created_at" timestamptz DEFAULT now(),
  "id" uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  "org_id" uuid,
  "role" text,
  "updated_at" timestamptz DEFAULT now(),
  "user_id" uuid
);

CREATE TABLE IF NOT EXISTS "feature_defs" (
  "category" text,
  "code" text,
  "created_at" timestamptz DEFAULT now(),
  "description" text,
  "enum_options" text,
  "id" uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  "is_public" boolean DEFAULT false,
  "label" text,
  "show_as_tick" text,
  "sort_order" text,
  "type" text,
  "unit" text,
  "updated_at" timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "plan_features" (
  "PRIMARY" text,
  "ai_meter_code" text,
  "ai_monthly_quota" text,
  "created_at" timestamptz DEFAULT now(),
  "feature_code" text,
  "id" uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  "plan_id" uuid,
  "updated_at" timestamptz DEFAULT now(),
  "value" text
);

CREATE TABLE IF NOT EXISTS "instagram_publish_jobs" (
  "UNIQUE" text,
  "account_id" uuid,
  "caption" text,
  "client_dedupe_key" text,
  "created_at" timestamptz DEFAULT now(),
  "creationId" text,
  "creation_id" uuid,
  "error" text,
  "id" uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  "jobId" text,
  "media" text,
  "org_id" uuid,
  "published_media_id" uuid,
  "scheduled_at" timestamptz DEFAULT now(),
  "status" text,
  "type" text,
  "updated_at" timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "facebook_publish_jobs" (
  "UNIQUE" text,
  "client_dedupe_key" text,
  "created_at" timestamptz DEFAULT now(),
  "error" text,
  "id" uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  "jobId" text,
  "link" text,
  "media" text,
  "message" text,
  "org_id" uuid,
  "page_id" uuid,
  "published_post_id" uuid,
  "scheduled_at" timestamptz DEFAULT now(),
  "status" text,
  "type" text,
  "updated_at" timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "channel_id_map" (
  "PRIMARY" text,
  "channel_type" text,
  "created_at" timestamptz DEFAULT now(),
  "external_id" uuid,
  "id" uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  "lead_id" uuid,
  "updated_at" timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "crm_opportunities" (
  "client_id" uuid,
  "cliente" text,
  "created_at" timestamptz DEFAULT now(),
  "id" uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  "lead_id" uuid,
  "org_id" uuid,
  "responsavel" text,
  "stage" text,
  "status" text,
  "title" text,
  "updated_at" timestamptz DEFAULT now(),
  "valor_estimado" text,
  "value" text
);

CREATE TABLE IF NOT EXISTS "appointments" (
  "channel_type" text,
  "created_at" timestamptz DEFAULT now(),
  "end_at" text,
  "id" uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  "lead_id" uuid,
  "start_at" text,
  "status" text,
  "title" text,
  "updated_at" timestamptz DEFAULT now(),
  "user_id" uuid
);

CREATE TABLE IF NOT EXISTS "calendar_integrations" (
  "PRIMARY" text,
  "created_at" timestamptz DEFAULT now(),
  "id" uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  "provider" text,
  "tokens" text,
  "updated_at" timestamptz DEFAULT now(),
  "user_id" uuid
);

CREATE TABLE IF NOT EXISTS "social_posts" (
  "approved_level" text,
  "channel" text,
  "channel_id" uuid,
  "company_id" uuid,
  "content" text,
  "created_at" timestamptz DEFAULT now(),
  "id" uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  "media_url" text,
  "org_id" uuid,
  "post_id" uuid,
  "published_at" timestamptz DEFAULT now(),
  "scheduled_at" timestamptz DEFAULT now(),
  "status" text,
  "title" text,
  "updated_at" timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "repurpose_jobs" (
  "created_at" timestamptz DEFAULT now(),
  "finished_at" timestamptz DEFAULT now(),
  "id" uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  "post_id" uuid,
  "result" text,
  "status" text,
  "updated_at" timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "attachments" (
  "checksum" text,
  "company_id" uuid,
  "created_at" timestamptz DEFAULT now(),
  "duration_ms" integer,
  "height" text,
  "id" uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  "kind" text,
  "message_id" uuid,
  "mime" text,
  "org_id" uuid,
  "size" text,
  "size_bytes" integer,
  "storage_key" text,
  "type" text,
  "updated_at" timestamptz DEFAULT now(),
  "url" text,
  "user_id" uuid,
  "width" text
);

CREATE TABLE IF NOT EXISTS "segments" (
  "company_id" uuid,
  "created_at" timestamptz DEFAULT now(),
  "filter" text,
  "id" uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  "name" text,
  "org_id" uuid,
  "updated_at" timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "ai_credit_usage" (
  "PRIMARY" text,
  "category" text,
  "created_at" timestamptz DEFAULT now(),
  "id" uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  "period_end" text,
  "period_start" text,
  "updated_at" timestamptz DEFAULT now(),
  "used" text,
  "userId" text,
  "user_id" uuid
);

CREATE TABLE IF NOT EXISTS "ai_usage_logs" (
  "created_at" timestamptz DEFAULT now(),
  "id" uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  "meta" text,
  "service" text,
  "tokens" text,
  "updated_at" timestamptz DEFAULT now(),
  "user_id" uuid
);

CREATE TABLE IF NOT EXISTS "lgpd_consents" (
  "consent" text,
  "created_at" timestamptz DEFAULT now(),
  "id" uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  "lead_id" uuid,
  "org_id" uuid,
  "purpose" text,
  "updated_at" timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "lgpd_erasure_requests" (
  "created_at" timestamptz DEFAULT now(),
  "id" uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  "lead_id" uuid,
  "org_id" uuid,
  "updated_at" timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "whatsapp_templates" (
  "body" text,
  "category" text,
  "created_at" timestamptz DEFAULT now(),
  "id" uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  "language" text,
  "name" text,
  "status" text,
  "updated_at" timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "clients" (
  "active" text,
  "cnpj" text,
  "company_name" text,
  "contract_url" text,
  "contrato_url" text,
  "cpf" text,
  "created_at" timestamptz DEFAULT now(),
  "email" citext,
  "end_date" date,
  "id" uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  "modules" text,
  "name" text,
  "nome" text,
  "org_id" uuid,
  "phone" text,
  "phone_e164" text,
  "plan_id" uuid,
  "responsavel" text,
  "start_date" date,
  "status" text,
  "telefone" text,
  "updated_at" timestamptz DEFAULT now(),
  "user_id" uuid
);

CREATE TABLE IF NOT EXISTS "usage_counters" (
  "UNIQUE" text,
  "client_id" uuid,
  "created_at" timestamptz DEFAULT now(),
  "id" uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  "module_key" text,
  "period_end" text,
  "period_start" text,
  "quota" text,
  "updated_at" timestamptz DEFAULT now(),
  "used" text
);

CREATE TABLE IF NOT EXISTS "onboarding_tasks" (
  "assinatura" text,
  "client_id" uuid,
  "contrato" text,
  "created_at" timestamptz DEFAULT now(),
  "id" uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  "nota_fiscal" text,
  "org_id" uuid,
  "status" text,
  "treinamento" text,
  "updated_at" timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "google_calendar_accounts" (
  "UNIQUE" text,
  "created_at" timestamptz DEFAULT now(),
  "display_name" text,
  "email" citext,
  "google_user_id" uuid,
  "id" uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  "is_active" boolean DEFAULT false,
  "org_id" uuid,
  "updated_at" timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "google_oauth_tokens" (
  "UNIQUE" text,
  "access_token" text,
  "account_id" uuid,
  "created_at" timestamptz DEFAULT now(),
  "expiry" text,
  "id" uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  "refresh_token" text,
  "scopes" text,
  "updated_at" timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "facebook_pages" (
  "UNIQUE" text,
  "category" text,
  "created_at" timestamptz DEFAULT now(),
  "id" uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  "is_active" boolean DEFAULT false,
  "name" text,
  "org_id" uuid,
  "page_id" uuid,
  "updated_at" timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "facebook_oauth_tokens" (
  "UNIQUE" text,
  "access_token" text,
  "created_at" timestamptz DEFAULT now(),
  "enc_ver" text,
  "expiry" text,
  "id" uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  "page_id" uuid,
  "scopes" text,
  "updated_at" timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "instagram_accounts" (
  "UNIQUE" text,
  "created_at" timestamptz DEFAULT now(),
  "id" uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  "ig_user_id" uuid,
  "is_active" boolean DEFAULT false,
  "name" text,
  "org_id" uuid,
  "updated_at" timestamptz DEFAULT now(),
  "username" text
);

CREATE TABLE IF NOT EXISTS "instagram_oauth_tokens" (
  "UNIQUE" text,
  "access_token" text,
  "account_id" uuid,
  "created_at" timestamptz DEFAULT now(),
  "enc_ver" text,
  "expiry" text,
  "id" uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  "scopes" text,
  "updated_at" timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "content_campaigns" (
  "created_at" timestamptz DEFAULT now(),
  "created_by" text,
  "default_targets" jsonb DEFAULT '{}'::jsonb,
  "id" uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  "month_ref" text,
  "org_id" uuid,
  "strategy_json" jsonb DEFAULT '{}'::jsonb,
  "title" text,
  "updated_at" timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "content_suggestions" (
  "ai_prompt_json" jsonb DEFAULT '{}'::jsonb,
  "approved_at" text,
  "approved_by" text,
  "asset_refs" jsonb DEFAULT '{}'::jsonb,
  "campaign_id" uuid,
  "channel_targets" jsonb DEFAULT '{}'::jsonb,
  "copy_json" jsonb DEFAULT '{}'::jsonb,
  "created_at" timestamptz DEFAULT now(),
  "date" date,
  "id" uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  "jobs_map" jsonb DEFAULT '{}'::jsonb,
  "org_id" uuid,
  "published_at" timestamptz DEFAULT now(),
  "reasoning_json" jsonb DEFAULT '{}'::jsonb,
  "status" text,
  "suggestionId" text,
  "time" text,
  "updated_at" timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "support_audit_logs" (
  "actor_user_id" uuid,
  "created_at" timestamptz DEFAULT now(),
  "id" uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  "method" text,
  "path" text,
  "target_org_id" uuid,
  "updated_at" timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "org_users" (
  "PRIMARY" text,
  "created_at" timestamptz DEFAULT now(),
  "id" uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  "org_id" uuid,
  "perms" text,
  "role" text,
  "updated_at" timestamptz DEFAULT now(),
  "user_id" uuid
);

CREATE TABLE IF NOT EXISTS "whatsapp_channels" (
  "UNIQUE" text,
  "created_at" timestamptz DEFAULT now(),
  "display_name" text,
  "id" uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  "is_active" boolean DEFAULT false,
  "org_id" uuid,
  "phone_e164" text,
  "provider" text,
  "updated_at" timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "contacts" (
  "UNIQUE" text,
  "birthdate" date,
  "cpf" text,
  "created_at" timestamptz DEFAULT now(),
  "display_name" text,
  "email" citext,
  "external_id" uuid,
  "first_name" text,
  "id" uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  "name" text,
  "notes" text,
  "org_id" uuid,
  "phone" text,
  "phone_e164" text,
  "photo_asset_id" uuid,
  "photo_url" text,
  "platform" text,
  "provider_user_id" uuid,
  "updated_at" timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "org_settings" (
  "ai_enabled" boolean DEFAULT false,
  "ai_handoff_keywords" text,
  "ai_max_turns_before_handoff" text,
  "alert_sound" text,
  "alert_volume" text,
  "allow_baileys" text,
  "business_hours" text,
  "created_at" timestamptz DEFAULT now(),
  "id" uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  "org_id" uuid,
  "templates_enabled_channels" text,
  "updated_at" timestamptz DEFAULT now(),
  "whatsapp_active_mode" text
);

CREATE TABLE IF NOT EXISTS "templates" (
  "body" text,
  "category" text,
  "channel" text,
  "created_at" timestamptz DEFAULT now(),
  "id" uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  "name" text,
  "org_id" uuid,
  "status" text,
  "updated_at" timestamptz DEFAULT now(),
  "variables" text
);

CREATE TABLE IF NOT EXISTS "org_tags" (
  "color" text,
  "created_at" timestamptz DEFAULT now(),
  "id" uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  "label" text,
  "org_id" uuid,
  "updated_at" timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "org_ai_profiles" (
  "created_at" timestamptz DEFAULT now(),
  "id" uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  "org_id" uuid,
  "profile" text,
  "updated_at" timestamptz DEFAULT now(),
  "updated_by" text
);

CREATE TABLE IF NOT EXISTS "ai_guardrail_violations" (
  "channel" text,
  "created_at" timestamptz DEFAULT now(),
  "created_by" text,
  "id" uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  "input_excerpt" text,
  "intent" text,
  "message" text,
  "org_id" uuid,
  "output_excerpt" text,
  "payload" text,
  "rule" text,
  "stage" text,
  "updated_at" timestamptz DEFAULT now(),
  "user_id" uuid
);

CREATE TABLE IF NOT EXISTS "kb_documents" (
  "active" text,
  "checksum" text,
  "created_at" timestamptz DEFAULT now(),
  "id" uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  "lang" text,
  "meta" text,
  "org_id" uuid,
  "source_type" text,
  "title" text,
  "updated_at" timestamptz DEFAULT now(),
  "uri" text
);

CREATE TABLE IF NOT EXISTS "channel_accounts" (
  "UNIQUE" text,
  "access_token_enc" text,
  "channel" text,
  "created_at" timestamptz DEFAULT now(),
  "external_account_id" uuid,
  "id" uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  "name" text,
  "org_id" uuid,
  "permissions_json" jsonb DEFAULT '{}'::jsonb,
  "token_expires_at" text,
  "updated_at" timestamptz DEFAULT now(),
  "username" text,
  "webhook_subscribed" text
);

CREATE TABLE IF NOT EXISTS "contact_identities" (
  "UNIQUE" text,
  "account_id" uuid,
  "channel" text,
  "contact_id" uuid,
  "created_at" timestamptz DEFAULT now(),
  "id" uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  "identity" text,
  "org_id" uuid,
  "updated_at" timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "reminder_logs" (
  "channel" text,
  "created_at" timestamptz DEFAULT now(),
  "event_id" uuid,
  "hash" text,
  "id" uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  "recipient" text,
  "sent_at" timestamptz DEFAULT now(),
  "updated_at" timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "assets" (
  "created_at" timestamptz DEFAULT now(),
  "file_name" text,
  "id" uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  "metadata" text,
  "mime_type" text,
  "org_id" uuid,
  "owner_id" uuid,
  "owner_type" text,
  "prompt" text,
  "size_bytes" integer,
  "updated_at" timestamptz DEFAULT now(),
  "url" text
);

CREATE TABLE IF NOT EXISTS "email_events" (
  "campaign_id" uuid,
  "created_at" timestamptz DEFAULT now(),
  "event_at" text,
  "event_type" text,
  "id" uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  "meta" text,
  "org_id" uuid,
  "payload" text,
  "recipient_id" uuid,
  "updated_at" timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "email_suppressions" (
  "UNIQUE" text,
  "created_at" timestamptz DEFAULT now(),
  "email" citext,
  "id" uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  "org_id" uuid,
  "reason" text,
  "updated_at" timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "payments" (
  "amount_cents" integer,
  "created_at" timestamptz DEFAULT now(),
  "id" uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  "meta" text,
  "org_id" uuid,
  "paid_at" timestamptz DEFAULT now(),
  "status" text,
  "subscription_id" uuid,
  "updated_at" timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "purchases" (
  "amount_cents" integer,
  "created_at" timestamptz DEFAULT now(),
  "id" uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  "item" text,
  "org_id" uuid,
  "status" text,
  "updated_at" timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "org_subscriptions" (
  "created_at" timestamptz DEFAULT now(),
  "id" uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  "org_id" uuid,
  "period" text,
  "plan_id" uuid,
  "trial_end" text,
  "trial_start" text,
  "updated_at" timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "ai_meters" (
  "code" text,
  "created_at" timestamptz DEFAULT now(),
  "id" uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  "name" text,
  "unit" text,
  "updated_at" timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "meta_tokens" (
  "created_at" timestamptz DEFAULT now(),
  "id" uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  "org_id" uuid,
  "token" text,
  "updated_at" timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "integration_events" (
  "created_at" timestamptz DEFAULT now(),
  "event_type" text,
  "id" uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  "org_id" uuid,
  "payload" text,
  "provider" text,
  "received_at" timestamptz DEFAULT now(),
  "updated_at" timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "org_integrations" (
  "UNIQUE" text,
  "created_at" timestamptz DEFAULT now(),
  "creds" text,
  "id" uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  "meta" text,
  "org_id" uuid,
  "provider" text,
  "status" text,
  "subscribed" text,
  "updated_at" timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "quick_replies" (
  "body" text,
  "company_id" uuid,
  "created_at" timestamptz DEFAULT now(),
  "id" uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  "title" text,
  "updated_at" timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "org_ai_settings" (
  "created_at" timestamptz DEFAULT now(),
  "id" uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  "org_id" uuid,
  "settings" text,
  "updated_at" timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "user_orgs" (
  "PRIMARY" text,
  "created_at" timestamptz DEFAULT now(),
  "id" uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  "org_id" uuid,
  "role" text,
  "updated_at" timestamptz DEFAULT now(),
  "user_id" uuid
);

CREATE TABLE IF NOT EXISTS "import_runs" (
  "attachments" text,
  "attachments_imported" text,
  "channel_account_id" uuid,
  "created_at" timestamptz DEFAULT now(),
  "errors" text,
  "finished_at" timestamptz DEFAULT now(),
  "id" uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  "kind" text,
  "messages_imported" text,
  "org_id" uuid,
  "stats" text,
  "status" text,
  "updated_at" timestamptz DEFAULT now(),
  "window_end" text,
  "window_start" text
);

CREATE TABLE IF NOT EXISTS "org_credits" (
  "created_at" timestamptz DEFAULT now(),
  "delta" text,
  "expires_at" text,
  "feature_code" text,
  "id" uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  "meta" text,
  "org_id" uuid,
  "source" text,
  "updated_at" timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "plans_meta" (
  "created_at" timestamptz DEFAULT now(),
  "id" uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  "max_users" text,
  "plan_id" uuid,
  "updated_at" timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "plan_credits" (
  "ai_attendance_monthly" text,
  "ai_content_monthly" text,
  "created_at" timestamptz DEFAULT now(),
  "id" uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  "plan_id" uuid,
  "updated_at" timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "org_plan_history" (
  "PRIMARY" text,
  "created_at" timestamptz DEFAULT now(),
  "end_at" text,
  "id" uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  "meta" text,
  "org_id" uuid,
  "plan_id" uuid,
  "source" text,
  "start_at" text,
  "status" text,
  "updated_at" timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "ai_usage" (
  "created_at" timestamptz DEFAULT now(),
  "id" uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  "meta" text,
  "meter_code" text,
  "org_id" uuid,
  "qty" text,
  "source" text,
  "updated_at" timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "telemetry_events" (
  "created_at" timestamptz DEFAULT now(),
  "event_key" text,
  "id" uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  "metadata" text,
  "occurred_at" timestamptz DEFAULT now(),
  "org_id" uuid,
  "source" text,
  "updated_at" timestamptz DEFAULT now(),
  "user_id" uuid,
  "value_num" numeric
);

CREATE TABLE IF NOT EXISTS "telemetry_kpis_daily" (
  "PRIMARY" text,
  "created_at" timestamptz DEFAULT now(),
  "day" text,
  "id" uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  "metric" text,
  "org_id" uuid,
  "updated_at" timestamptz DEFAULT now(),
  "value" text
);

CREATE TABLE IF NOT EXISTS "org_integration_logs" (
  "created_at" timestamptz DEFAULT now(),
  "event" text,
  "id" uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  "ok" text,
  "org_id" uuid,
  "payload" text,
  "provider" text,
  "updated_at" timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "tags" (
  "UNIQUE" text,
  "color" text,
  "created_at" timestamptz DEFAULT now(),
  "id" uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  "name" text,
  "org_id" uuid,
  "updated_at" timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "contact_tags" (
  "PRIMARY" text,
  "contact_id" uuid,
  "created_at" timestamptz DEFAULT now(),
  "id" uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  "org_id" uuid,
  "tag_id" uuid,
  "updated_at" timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "message_status_events" (
  "created_at" timestamptz DEFAULT now(),
  "error" text,
  "id" uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  "message_id" uuid,
  "status" text,
  "updated_at" timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "post_approvals" (
  "approver_id" uuid,
  "created_at" timestamptz DEFAULT now(),
  "id" uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  "notes" text,
  "post_id" uuid,
  "status" text,
  "updated_at" timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "email_automation_steps" (
  "automation_id" uuid,
  "config" text,
  "created_at" timestamptz DEFAULT now(),
  "id" uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  "kind" text,
  "step_order" text,
  "updated_at" timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "inbox_idempotency" (
  "created_at" timestamptz DEFAULT now(),
  "id" uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  "key" text,
  "ttl" text,
  "updated_at" timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "inbox_audit_events" (
  "action" text,
  "actor_id" uuid,
  "created_at" timestamptz DEFAULT now(),
  "id" uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  "meta" text,
  "org_id" uuid,
  "target_id" uuid,
  "target_type" text,
  "updated_at" timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "inbox_ai_flags" (
  "conversation_id" uuid,
  "created_at" timestamptz DEFAULT now(),
  "flag" text,
  "id" uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  "org_id" uuid,
  "updated_at" timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "support_tickets" (
  "created_at" timestamptz DEFAULT now(),
  "description" text,
  "id" uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  "org_id" uuid,
  "status" text,
  "subject" text,
  "updated_at" timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "usage_reports" (
  "created_at" timestamptz DEFAULT now(),
  "id" uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  "metrics" text,
  "org_id" uuid,
  "period_end" text,
  "period_start" text,
  "updated_at" timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "existing_company" (
  "created_at" timestamptz DEFAULT now(),
  "id" uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  "updated_at" timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "ins_company" (
  "created_at" timestamptz DEFAULT now(),
  "id" uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  "updated_at" timestamptz DEFAULT now()
);

CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW IS DISTINCT FROM OLD THEN NEW.updated_at := now();

END IF;

RETURN NEW;

END $$;

DO $$
DECLARE rec record;

BEGIN
  FOR rec IN SELECT table_name FROM information_schema.columns WHERE table_schema='public' AND column_name='updated_at' LOOP
    EXECUTE format('CREATE TRIGGER %I BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION set_updated_at()', rec.table_name||'_set_updated_at', rec.table_name);

END LOOP;

EXCEPTION WHEN others THEN NULL;

END $$;


--Apaga tabelas desnecessárias
DO $$
DECLARE
  alvo text[];
  r text;
BEGIN
  -- nomes que você pediu para dropar
  alvo := ARRAY[
    'appointments','attachments','base','calendar_integrations','cfg','companies',
    'data','email_segments','existing','existing_company','import_runs','indexes',
    'ins_company','old','org_members','org_memberships','org_tags','organization_settings',
    'outbound','p','pairs','templates','unnest','whatsapp_templates'
    -- intencionalmente NÃO incluí: 'public','information_schema','pg_*' (não são tabelas públicas)
  ];

  -- 1) dropar VIEWS primeiro (se existirem) no schema public
  FOR r IN
    SELECT table_name
      FROM information_schema.views
     WHERE table_schema = 'public'
       AND table_name = ANY(alvo)
  LOOP
    EXECUTE format('DROP VIEW IF EXISTS %I.%I CASCADE;', 'public', r);
  END LOOP;

  -- 2) dropar TABLES no schema public
  FOR r IN
    SELECT table_name
      FROM information_schema.tables
     WHERE table_schema = 'public'
       AND table_type   = 'BASE TABLE'
       AND table_name   = ANY(alvo)
  LOOP
    EXECUTE format('DROP TABLE IF EXISTS %I.%I CASCADE;', 'public', r);
  END LOOP;
END $$;

DO $$
DECLARE
  r record;
  conname_var text;
BEGIN
  -- (src_table, src_col, ref_table, ref_col, on_delete)
  FOR r IN
    SELECT *
    FROM (VALUES
      -- === RELACIONAMENTOS (mesma lista que você já estava usando) ===
      ('users','org_id','organizations','id','SET NULL'),

      ('org_users','org_id','organizations','id','CASCADE'),
      ('org_users','user_id','users','id','CASCADE'),

      ('user_orgs','user_id','users','id','CASCADE'),
      ('user_orgs','org_id','organizations','id','CASCADE'),

      ('support_audit_logs','actor_user_id','users','id','SET NULL'),
      ('support_audit_logs','target_org_id','organizations','id','CASCADE'),

      ('plans_meta','plan_id','plans','id','CASCADE'),
      ('plan_features','plan_id','plans','id','CASCADE'),
      ('plan_credits','plan_id','plans','id','CASCADE'),

      ('org_plan_history','org_id','organizations','id','CASCADE'),
      ('org_plan_history','plan_id','plans','id','SET NULL'),

      ('org_subscriptions','org_id','organizations','id','CASCADE'),
      ('org_subscriptions','plan_id','plans','id','SET NULL'),

      ('subscriptions','org_id','organizations','id','CASCADE'),
      ('subscriptions','user_id','users','id','SET NULL'),
      ('subscriptions','plan_id','plans','id','SET NULL'),

      ('invoices','org_id','organizations','id','CASCADE'),
      ('invoices','subscription_id','subscriptions','id','SET NULL'),

      ('payments','org_id','organizations','id','CASCADE'),
      ('payments','subscription_id','subscriptions','id','SET NULL'),

      ('purchases','org_id','organizations','id','CASCADE'),

      ('ai_usage','org_id','organizations','id','CASCADE'),
      ('ai_credit_usage','user_id','users','id','CASCADE'),
      ('ai_usage_logs','user_id','users','id','SET NULL'),
      ('ai_guardrail_violations','org_id','organizations','id','CASCADE'),
      ('ai_guardrail_violations','user_id','users','id','SET NULL'),

      ('org_ai_profiles','org_id','organizations','id','CASCADE'),
      ('org_ai_profiles','updated_by','users','id','SET NULL'),
      ('org_ai_settings','org_id','organizations','id','CASCADE'),

      ('telemetry_events','org_id','organizations','id','CASCADE'),
      ('telemetry_events','user_id','users','id','SET NULL'),
      ('telemetry_kpis_daily','org_id','organizations','id','CASCADE'),

      ('meta_tokens','org_id','organizations','id','CASCADE'),

      ('org_integrations','org_id','organizations','id','CASCADE'),
      ('org_integration_logs','org_id','organizations','id','CASCADE'),
      ('integration_events','org_id','organizations','id','CASCADE'),

      ('google_calendar_accounts','org_id','organizations','id','CASCADE'),
      ('google_oauth_tokens','account_id','google_calendar_accounts','id','CASCADE'),

      ('whatsapp_channels','org_id','organizations','id','CASCADE'),

      ('facebook_pages','org_id','organizations','id','CASCADE'),
      ('facebook_oauth_tokens','page_id','facebook_pages','id','CASCADE'),

      ('instagram_accounts','org_id','organizations','id','CASCADE'),
      ('instagram_oauth_tokens','account_id','instagram_accounts','id','CASCADE'),
      ('instagram_publish_jobs','org_id','organizations','id','CASCADE'),
      ('instagram_publish_jobs','account_id','instagram_accounts','id','CASCADE'),

      ('facebook_publish_jobs','org_id','organizations','id','CASCADE'),
      ('facebook_publish_jobs','page_id','facebook_pages','id','CASCADE'),

      ('channel_accounts','org_id','organizations','id','CASCADE'),
      ('channels','org_id','organizations','id','CASCADE'),

      ('contacts','org_id','organizations','id','CASCADE'),
      ('contacts','photo_asset_id','assets','id','SET NULL'),

      ('contact_identities','org_id','organizations','id','CASCADE'),
      ('contact_identities','account_id','channel_accounts','id','SET NULL'),
      ('contact_identities','contact_id','contacts','id','CASCADE'),

      ('tags','org_id','organizations','id','CASCADE'),

      ('contact_tags','contact_id','contacts','id','CASCADE'),
      ('contact_tags','tag_id','tags','id','CASCADE'),
      ('contact_tags','org_id','organizations','id','CASCADE'),

      ('clients','org_id','organizations','id','CASCADE'),
      ('clients','plan_id','plans','id','SET NULL'),

      ('usage_counters','client_id','clients','id','CASCADE'),

      ('leads','org_id','organizations','id','CASCADE'),

      ('channel_id_map','lead_id','leads','id','CASCADE'),

      ('crm_opportunities','org_id','organizations','id','CASCADE'),
      ('crm_opportunities','lead_id','leads','id','SET NULL'),
      ('crm_opportunities','client_id','clients','id','SET NULL'),

      ('opportunities','org_id','organizations','id','CASCADE'),
      ('opportunities','lead_id','leads','id','SET NULL'),

      ('org_settings','org_id','organizations','id','CASCADE'),

      ('conversations','org_id','organizations','id','CASCADE'),
      ('conversations','contact_id','contacts','id','SET NULL'),
      ('conversations','client_id','clients','id','SET NULL'),
      ('conversations','channel_id','channels','id','SET NULL'),
      ('conversations','assigned_to','users','id','SET NULL'),
      ('conversations','handoff_ack_by','users','id','SET NULL'),

      ('messages','org_id','organizations','id','CASCADE'),
      ('messages','conversation_id','conversations','id','CASCADE'),
      ('messages','lead_id','leads','id','SET NULL'),
      ('messages','author_id','users','id','SET NULL'),
      ('messages','sender_user_id','users','id','SET NULL'),

      ('message_status_events','message_id','messages','id','CASCADE'),

      ('message_attachments','org_id','organizations','id','CASCADE'),
      ('message_attachments','message_id','messages','id','CASCADE'),
      ('message_attachments','asset_id','assets','id','SET NULL'),

      ('message_transcripts','org_id','organizations','id','CASCADE'),
      ('message_transcripts','message_id','messages','id','CASCADE'),

      ('message_templates','org_id','organizations','id','CASCADE'),

      ('quick_replies','company_id','organizations','id','CASCADE'),

      ('content_assets','org_id','organizations','id','CASCADE'),
      ('content_assets','created_by','users','id','SET NULL'),

      ('posts','org_id','organizations','id','CASCADE'),
      ('posts','created_by','users','id','SET NULL'),
      ('posts','approved_by','users','id','SET NULL'),

      ('post_approvals','post_id','posts','id','CASCADE'),
      ('post_approvals','approver_id','users','id','SET NULL'),

      ('content_campaigns','org_id','organizations','id','CASCADE'),
      ('content_campaigns','created_by','users','id','SET NULL'),

      ('content_suggestions','campaign_id','content_campaigns','id','CASCADE'),
      ('content_suggestions','org_id','organizations','id','CASCADE'),
      ('content_suggestions','approved_by','users','id','SET NULL'),

      ('social_posts','org_id','organizations','id','CASCADE'),
      ('social_posts','post_id','posts','id','SET NULL'),
      ('social_posts','channel_id','channels','id','SET NULL'),

      ('repurpose_jobs','post_id','posts','id','CASCADE'),

      ('email_lists','org_id','organizations','id','CASCADE'),
      ('email_templates','org_id','organizations','id','CASCADE'),

      ('email_subscriptions','org_id','organizations','id','CASCADE'),
      ('email_subscriptions','list_id','email_lists','id','CASCADE'),
      ('email_subscriptions','contact_id','contacts','id','SET NULL'),

      ('email_campaigns','org_id','organizations','id','CASCADE'),
      ('email_campaigns','template_id','email_templates','id','SET NULL'),
      ('email_campaigns','list_id','email_lists','id','SET NULL'),

      ('email_campaign_recipients','org_id','organizations','id','CASCADE'),
      ('email_campaign_recipients','campaign_id','email_campaigns','id','CASCADE'),
      ('email_campaign_recipients','subscription_id','email_subscriptions','id','SET NULL'),

      ('email_events','org_id','organizations','id','CASCADE'),
      ('email_events','campaign_id','email_campaigns','id','SET NULL'),
      ('email_events','recipient_id','email_campaign_recipients','id','SET NULL'),

      ('email_automations','org_id','organizations','id','CASCADE'),
      ('email_automations','template_id','email_templates','id','SET NULL'),

      ('email_automation_steps','automation_id','email_automations','id','CASCADE'),

      ('email_suppressions','org_id','organizations','id','CASCADE'),

      ('segments','org_id','organizations','id','CASCADE'),

      ('calendars','org_id','organizations','id','CASCADE'),

      ('calendar_members','org_id','organizations','id','CASCADE'),
      ('calendar_members','calendar_id','calendars','id','CASCADE'),
      ('calendar_members','user_id','users','id','CASCADE'),

      ('calendar_events','org_id','organizations','id','CASCADE'),
      ('calendar_events','calendar_id','calendars','id','SET NULL'),
      ('calendar_events','contact_id','contacts','id','SET NULL'),
      ('calendar_events','opportunity_id','crm_opportunities','id','SET NULL'),

      ('audit_logs','org_id','organizations','id','CASCADE'),
      ('audit_logs','user_id','users','id','SET NULL'),

      ('lgpd_consents','org_id','organizations','id','CASCADE'),
      ('lgpd_consents','lead_id','leads','id','CASCADE'),

      ('lgpd_erasure_requests','org_id','organizations','id','CASCADE'),
      ('lgpd_erasure_requests','lead_id','leads','id','CASCADE'),

      ('nps_surveys','org_id','organizations','id','CASCADE'),
      ('nps_surveys','client_id','clients','id','CASCADE'),

      ('nps_responses','survey_id','nps_surveys','id','CASCADE'),
      ('nps_responses','client_id','clients','id','SET NULL'),

      ('rewards','org_id','organizations','id','CASCADE'),
      ('rewards','client_id','clients','id','CASCADE'),

      ('onboarding_tasks','org_id','organizations','id','CASCADE'),
      ('onboarding_tasks','client_id','clients','id','CASCADE'),

      ('org_features','org_id','organizations','id','CASCADE'),
      ('kb_documents','org_id','organizations','id','CASCADE'),
      ('assets','org_id','organizations','id','CASCADE'),

      ('inbox_audit_events','org_id','organizations','id','CASCADE'),
      ('inbox_audit_events','actor_id','users','id','SET NULL'),

      ('inbox_ai_flags','org_id','organizations','id','CASCADE'),
      ('inbox_ai_flags','conversation_id','conversations','id','CASCADE'),

      ('support_tickets','org_id','organizations','id','CASCADE'),

      ('usage_reports','org_id','organizations','id','CASCADE')
    ) AS fk(src_table, src_col, ref_table, ref_col, on_delete)
  LOOP
    -- origem existe?
    IF NOT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema='public'
        AND table_name=r.src_table
        AND column_name=r.src_col
    ) THEN
      CONTINUE;
    END IF;

    -- destino existe?
    IF NOT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema='public'
        AND table_name=r.ref_table
        AND column_name=r.ref_col
    ) THEN
      CONTINUE;
    END IF;

    -- índice na coluna FK
    EXECUTE format(
      'CREATE INDEX IF NOT EXISTS %I ON %I (%I);',
      'idx_'||r.src_table||'_'||r.src_col, r.src_table, r.src_col
    );

    -- nome determinístico da constraint
    conname_var := format('fk_%s_%s__%s_%s', r.src_table, r.src_col, r.ref_table, r.ref_col);

    -- já existe constraint com esse nome **na tabela de origem**?
    IF EXISTS (
      SELECT 1
      FROM pg_constraint c
      WHERE c.conname = conname_var
        AND c.conrelid = format('public.%s', r.src_table)::regclass
    ) THEN
      CONTINUE;
    END IF;

    -- cria NOT VALID para não travar com dados órfãos
    BEGIN
      EXECUTE format(
        'ALTER TABLE %I ADD CONSTRAINT %I FOREIGN KEY (%I) REFERENCES %I(%I) ON DELETE %s NOT VALID;',
        r.src_table, conname_var, r.src_col, r.ref_table, r.ref_col, r.on_delete
      );
    EXCEPTION WHEN others THEN
      CONTINUE;
    END;

    -- tenta validar
    BEGIN
      EXECUTE format('ALTER TABLE %I VALIDATE CONSTRAINT %I;', r.src_table, conname_var);
    EXCEPTION WHEN others THEN
      NULL;
    END;
  END LOOP;
END $$;

-- 1) cria a coluna (se não existir)
ALTER TABLE users ADD COLUMN IF NOT EXISTS org_id uuid;

-- 2) índice para performance
CREATE INDEX IF NOT EXISTS idx_users_org_id ON users (org_id);

-- 3) FK (NOT VALID para não travar se houver dados antigos sem org)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='fk_users_org_id__organizations_id') THEN
    ALTER TABLE users
      ADD CONSTRAINT fk_users_org_id__organizations_id
      FOREIGN KEY (org_id) REFERENCES organizations(id)
      ON DELETE SET NULL NOT VALID;
    BEGIN
      ALTER TABLE users VALIDATE CONSTRAINT fk_users_org_id__organizations_id;
    EXCEPTION WHEN others THEN NULL; END;
  END IF;
END $$;

-- Organizations: adicione apenas o que fizer sentido para você
ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS email          text,
  ADD COLUMN IF NOT EXISTS phone_e164     text,
  ADD COLUMN IF NOT EXISTS document_value text;

-- Contacts (se você indexa por telefone/email)
ALTER TABLE contacts
  ADD COLUMN IF NOT EXISTS phone_e164 text,

-- (opcional) se já houver um campo 'phone', você pode copiar por enquanto
-- UPDATE organizations SET phone_e164 = phone WHERE phone_e164 IS NULL;

-- 2) índice único parcial
CREATE UNIQUE INDEX IF NOT EXISTS ux_org_phone_e164
  ON organizations (phone_e164)
  WHERE phone_e164 IS NOT NULL;

ALTER TABLE conversations
  ADD COLUMN IF NOT EXISTS last_message_at timestamptz;
  
  -- usa sent_at quando houver; senão, created_at
UPDATE conversations c
SET last_message_at = sub.last_at
FROM (
  SELECT conversation_id,
         MAX(COALESCE(sent_at, created_at)) AS last_at
  FROM messages
  GROUP BY conversation_id
) AS sub
WHERE c.id = sub.conversation_id
  AND (c.last_message_at IS NULL OR c.last_message_at < sub.last_at);
  
  -- função
CREATE OR REPLACE FUNCTION bump_conversation_last_message_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  UPDATE conversations
     SET last_message_at = COALESCE(NEW.sent_at, NEW.created_at, now()),
         updated_at      = now()
   WHERE id = NEW.conversation_id;
  RETURN NEW;
END $$;

-- trigger
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'messages_after_insert_bump_last'
  ) THEN
    CREATE TRIGGER messages_after_insert_bump_last
      AFTER INSERT ON messages
      FOR EACH ROW EXECUTE FUNCTION bump_conversation_last_message_at();
  END IF;
END $$;

-- habilita extensão de trigram (necessária para gin_trgm_ops)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- messages.meta (jsonb) → GIN padrão
CREATE INDEX IF NOT EXISTS idx_messages_meta_gin
  ON messages USING GIN (meta);


CREATE INDEX IF NOT EXISTS idx_org_features_gin
  ON org_features USING GIN (features);

-- precisamos de pg_trgm apenas se fôssemos indexar TEXT com trigram; aqui deixo por segurança
CREATE EXTENSION IF NOT EXISTS pg_trgm;

DO $$
DECLARE
  coltype text;
BEGIN
  SELECT data_type INTO coltype
  FROM information_schema.columns
  WHERE table_schema='public' AND table_name='org_features' AND column_name='features';

  IF coltype IS NULL THEN
    RAISE NOTICE 'Tabela/coluna org_features.features não encontrada; nada a fazer.';
    RETURN;
  END IF;

  IF coltype = 'jsonb' THEN
    -- Já é jsonb: só garantir o índice GIN padrão
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_org_features_gin ON org_features USING GIN (features);';
    RAISE NOTICE 'org_features.features já é jsonb; criado/garantido índice GIN.';

  ELSIF coltype = 'text' THEN
    -- Migrar de text -> jsonb com parse seguro
    EXECUTE '
      DROP INDEX IF EXISTS idx_org_features_gin;  -- caso tenha criado um trigram antes

      ALTER TABLE org_features
        ADD COLUMN IF NOT EXISTS features_jsonb jsonb;

      CREATE OR REPLACE FUNCTION try_parse_jsonb(t text)
      RETURNS jsonb
      LANGUAGE plpgsql
      IMMUTABLE
      STRICT
      AS $fn$
      BEGIN
        RETURN t::jsonb;
      EXCEPTION WHEN others THEN
        RETURN NULL;
      END
      $fn$;

      UPDATE org_features
         SET features_jsonb = try_parse_jsonb(features)
       WHERE features IS NOT NULL
         AND features_jsonb IS NULL;

      -- Se quiser ver linhas que não converteram: 
      -- SELECT id, features FROM org_features WHERE features IS NOT NULL AND features_jsonb IS NULL;

      ALTER TABLE org_features DROP COLUMN IF EXISTS features;
      ALTER TABLE org_features RENAME COLUMN features_jsonb TO features;

      CREATE INDEX IF NOT EXISTS idx_org_features_gin
        ON org_features USING GIN (features);
    ';
    RAISE NOTICE 'org_features.features migrado de text -> jsonb e indexado.';

  ELSE
    RAISE NOTICE 'Tipo % em org_features.features não suportado automaticamente; nenhuma ação.', coltype;
  END IF;
END $$;

ALTER TABLE channels
  ADD COLUMN IF NOT EXISTS config  jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS secrets jsonb DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_channels_config_gin  ON channels USING GIN (config);
CREATE INDEX IF NOT EXISTS idx_channels_secrets_gin ON channels USING GIN (secrets);

-- =========================
-- instagram_publish_jobs.status (ENUM)
-- =========================

-- 1) Enum usado para o status do Instagram
DO $$ BEGIN
  CREATE TYPE instagram_publish_status AS ENUM
    ('pending','creating','ready','publishing','done','failed','canceled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2) Adiciona coluna (se ainda não existir), com default
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema='public' AND table_name='instagram_publish_jobs'
  ) THEN
    -- cria a coluna se não existir (inicialmente permitindo NULL)
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema='public' AND table_name='instagram_publish_jobs' AND column_name='status'
    ) THEN
      EXECUTE
        'ALTER TABLE instagram_publish_jobs
           ADD COLUMN status instagram_publish_status DEFAULT ''pending'';';
    END IF;

    -- backfill de nulos para 'pending'
    EXECUTE
      'UPDATE instagram_publish_jobs
          SET status = ''pending''
        WHERE status IS NULL;';

    -- garante NOT NULL
    EXECUTE
      'ALTER TABLE instagram_publish_jobs
         ALTER COLUMN status SET NOT NULL;';

    -- índice
    EXECUTE
      'CREATE INDEX IF NOT EXISTS idx_instagram_jobs_status
         ON instagram_publish_jobs (status);';
  END IF;
END $$;

-- =========================
-- facebook_publish_jobs.status (TEXT + CHECK)
-- =========================
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema='public' AND table_name='facebook_publish_jobs'
  ) THEN
    -- cria a coluna se não existir (como text)
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema='public' AND table_name='facebook_publish_jobs' AND column_name='status'
    ) THEN
      EXECUTE
        'ALTER TABLE facebook_publish_jobs
           ADD COLUMN status text;';
    END IF;

    -- default
    EXECUTE
      'ALTER TABLE facebook_publish_jobs
         ALTER COLUMN status SET DEFAULT ''pending'';';

    -- backfill de nulos
    EXECUTE
      'UPDATE facebook_publish_jobs
          SET status = ''pending''
        WHERE status IS NULL;';

    -- constraint de domínio (cria se não existir)
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint WHERE conname = 'chk_fb_jobs_status_domain'
    ) THEN
      BEGIN
        EXECUTE
          'ALTER TABLE facebook_publish_jobs
             ADD CONSTRAINT chk_fb_jobs_status_domain
             CHECK (status IN (''pending'',''creating'',''ready'',''publishing'',''done'',''failed'',''canceled''));';
      EXCEPTION WHEN others THEN
        -- se houver valores fora da lista, você pode corrigir depois e recriar a CHECK
        NULL;
      END;
    END IF;

    -- (opcional) NOT NULL se quiser forçar sempre preenchido
    -- EXECUTE 'ALTER TABLE facebook_publish_jobs ALTER COLUMN status SET NOT NULL;';

    -- índice
    EXECUTE
      'CREATE INDEX IF NOT EXISTS idx_fb_jobs_status
         ON facebook_publish_jobs (status);';
  END IF;
END $$;


DO $$
BEGIN
  -- Garante a tabela
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema='public' AND table_name='facebook_publish_jobs'
  ) THEN

    -- Cria scheduled_at se não existir
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema='public' AND table_name='facebook_publish_jobs' AND column_name='scheduled_at'
    ) THEN
      EXECUTE 'ALTER TABLE facebook_publish_jobs ADD COLUMN scheduled_at timestamptz;';
    END IF;

    -- Garante org_id (caso falte)
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema='public' AND table_name='facebook_publish_jobs' AND column_name='org_id'
    ) THEN
      EXECUTE 'ALTER TABLE facebook_publish_jobs ADD COLUMN org_id uuid;';
    END IF;

    -- (Opcional) cria FK para organizations, se ainda não existir
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint WHERE conname='fk_fb_jobs_org_id__organizations_id'
    ) AND EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema='public' AND table_name='organizations'
    ) THEN
      EXECUTE
        'ALTER TABLE facebook_publish_jobs
           ADD CONSTRAINT fk_fb_jobs_org_id__organizations_id
           FOREIGN KEY (org_id) REFERENCES organizations(id)
           ON DELETE CASCADE NOT VALID;';
      BEGIN
        EXECUTE 'ALTER TABLE facebook_publish_jobs VALIDATE CONSTRAINT fk_fb_jobs_org_id__organizations_id;';
      EXCEPTION WHEN others THEN NULL;
      END;
    END IF;

    -- Índice composto
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_fb_jobs_org_sched ON facebook_publish_jobs (org_id, scheduled_at);';
  END IF;
END $$;

DO $$
BEGIN
  -- 1) garante a coluna org_id em invoices
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='invoices' AND column_name='org_id'
  ) THEN
    EXECUTE 'ALTER TABLE invoices ADD COLUMN org_id uuid;';
  END IF;

  -- 2) tenta backfill a partir de subscriptions.org_id (se subscription_id existir)
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='invoices' AND column_name='subscription_id'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='subscriptions' AND column_name='org_id'
  ) THEN
    EXECUTE $sql$
      UPDATE invoices i
         SET org_id = s.org_id
        FROM subscriptions s
       WHERE i.subscription_id = s.id
         AND i.org_id IS NULL
         AND s.org_id IS NOT NULL;
    $sql$;
  END IF;

  -- 3) cria FK (NOT VALID para não travar se houver alguma fatura ainda sem org)
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname='fk_invoices_org_id__organizations_id'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema='public' AND table_name='organizations'
  ) THEN
    BEGIN
      EXECUTE '
        ALTER TABLE invoices
          ADD CONSTRAINT fk_invoices_org_id__organizations_id
          FOREIGN KEY (org_id) REFERENCES organizations(id)
          ON DELETE CASCADE NOT VALID;';
      -- tenta validar; se houver linhas sem org, mantém NOT VALID
      EXECUTE 'ALTER TABLE invoices VALIDATE CONSTRAINT fk_invoices_org_id__organizations_id;';
    EXCEPTION WHEN others THEN
      NULL;
    END;
  END IF;

  -- 4) índice composto (org_id, created_at)
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='invoices' AND column_name='org_id'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='invoices' AND column_name='created_at'
  ) THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_invoices_org ON invoices (org_id, created_at DESC);';
  END IF;
END $$;

DO $$
DECLARE
  parts text := '';
BEGIN
  -- 1) Garante colunas
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='invoices' AND column_name='org_id'
  ) THEN
    EXECUTE 'ALTER TABLE invoices ADD COLUMN org_id uuid;';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='invoices' AND column_name='created_at'
  ) THEN
    EXECUTE 'ALTER TABLE invoices ADD COLUMN created_at timestamptz;';
  END IF;

  -- 2) Backfill de created_at usando só as colunas que existirem
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='invoices' AND column_name='paid_at'
  ) THEN
    parts := parts || 'paid_at::timestamptz,';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='invoices' AND column_name='due_date'
  ) THEN
    parts := parts || 'due_date::timestamptz,';
  END IF;

  -- Sempre inclui NOW() como último fallback
  parts := parts || 'NOW()';

  -- Executa o backfill apenas se houver linhas nulas
  IF EXISTS (SELECT 1 FROM invoices WHERE created_at IS NULL) THEN
    EXECUTE format('UPDATE invoices SET created_at = COALESCE(%s) WHERE created_at IS NULL;', parts);
  END IF;

  -- Define default para novos registros
  EXECUTE 'ALTER TABLE invoices ALTER COLUMN created_at SET DEFAULT NOW();';

  -- 3) Backfill org_id a partir de subscriptions.org_id, se a relação existir
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='invoices' AND column_name='subscription_id'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='subscriptions' AND column_name='org_id'
  ) THEN
    EXECUTE $SQL$
      UPDATE invoices i
         SET org_id = s.org_id
        FROM subscriptions s
       WHERE i.subscription_id = s.id
         AND i.org_id IS NULL
         AND s.org_id IS NOT NULL;
    $SQL$;
  END IF;

  -- 4) FK para organizations (NOT VALID para não travar se ficar alguma fatura sem org)
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname='fk_invoices_org_id__organizations_id'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema='public' AND table_name='organizations'
  ) THEN
    BEGIN
      EXECUTE 'ALTER TABLE invoices
                 ADD CONSTRAINT fk_invoices_org_id__organizations_id
                 FOREIGN KEY (org_id) REFERENCES organizations(id)
                 ON DELETE CASCADE NOT VALID;';
      -- tenta validar; se falhar por linhas sem org, seguimos
      EXECUTE 'ALTER TABLE invoices VALIDATE CONSTRAINT fk_invoices_org_id__organizations_id;';
    EXCEPTION WHEN others THEN NULL;
    END;
  END IF;

  -- 5) Índice composto (org_id, created_at) se ambas existem
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='invoices' AND column_name='org_id'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='invoices' AND column_name='created_at'
  ) THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_invoices_org ON invoices (org_id, created_at DESC);';
  END IF;
END $$;

DO $$
DECLARE
  has_paid_at boolean := false;
BEGIN
  -- 1) Garante colunas
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='payments' AND column_name='org_id'
  ) THEN
    EXECUTE 'ALTER TABLE payments ADD COLUMN org_id uuid;';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='payments' AND column_name='created_at'
  ) THEN
    EXECUTE 'ALTER TABLE payments ADD COLUMN created_at timestamptz;';
  END IF;

  -- 2) Backfill de created_at
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='payments' AND column_name='paid_at'
  ) INTO has_paid_at;

  IF has_paid_at THEN
    EXECUTE 'UPDATE payments SET created_at = COALESCE(paid_at::timestamptz, NOW()) WHERE created_at IS NULL;';
  ELSE
    EXECUTE 'UPDATE payments SET created_at = NOW() WHERE created_at IS NULL;';
  END IF;

  EXECUTE 'ALTER TABLE payments ALTER COLUMN created_at SET DEFAULT NOW();';

  -- 3) Backfill de org_id
  -- 3a) via subscriptions (payments.subscription_id -> subscriptions.id -> subscriptions.org_id)
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='payments' AND column_name='subscription_id'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='subscriptions' AND column_name='org_id'
  ) THEN
    EXECUTE $SQL$
      UPDATE payments p
         SET org_id = s.org_id
        FROM subscriptions s
       WHERE p.subscription_id = s.id
         AND p.org_id IS NULL
         AND s.org_id IS NOT NULL;
    $SQL$;
  END IF;

  -- 3b) via invoices (payments.invoice_id -> invoices.id -> invoices.org_id)
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='payments' AND column_name='invoice_id'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='invoices' AND column_name='org_id'
  ) THEN
    EXECUTE $SQL$
      UPDATE payments p
         SET org_id = i.org_id
        FROM invoices i
       WHERE p.invoice_id = i.id
         AND p.org_id IS NULL
         AND i.org_id IS NOT NULL;
    $SQL$;
  END IF;

  -- 4) FK para organizations (NOT VALID pra não travar se restarem linhas sem org)
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname='fk_payments_org_id__organizations_id'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema='public' AND table_name='organizations'
  ) THEN
    BEGIN
      EXECUTE 'ALTER TABLE payments
                 ADD CONSTRAINT fk_payments_org_id__organizations_id
                 FOREIGN KEY (org_id) REFERENCES organizations(id)
                 ON DELETE CASCADE NOT VALID;';
      EXECUTE 'ALTER TABLE payments VALIDATE CONSTRAINT fk_payments_org_id__organizations_id;';
    EXCEPTION WHEN others THEN NULL;
    END;
  END IF;

  -- 5) Índice composto (org_id, created_at)
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='payments' AND column_name='org_id'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='payments' AND column_name='created_at'
  ) THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_payments_org_created ON payments (org_id, created_at DESC);';
  END IF;
END $$;

DO $$
BEGIN
  -- 1) Garante colunas
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='purchases' AND column_name='org_id'
  ) THEN
    EXECUTE 'ALTER TABLE purchases ADD COLUMN org_id uuid;';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='purchases' AND column_name='created_at'
  ) THEN
    EXECUTE 'ALTER TABLE purchases ADD COLUMN created_at timestamptz;';
  END IF;

  -- 2) Backfill de created_at (fallback = NOW())
  IF EXISTS (SELECT 1 FROM purchases WHERE created_at IS NULL) THEN
    EXECUTE 'UPDATE purchases SET created_at = NOW() WHERE created_at IS NULL;';
  END IF;

  -- 3) Backfill de org_id a partir de relações conhecidas

  -- 3a) via subscriptions (purchases.subscription_id -> subscriptions.id -> subscriptions.org_id)
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='purchases' AND column_name='subscription_id'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='subscriptions' AND column_name='org_id'
  ) THEN
    EXECUTE $SQL$
      UPDATE purchases p
         SET org_id = s.org_id
        FROM subscriptions s
       WHERE p.subscription_id = s.id
         AND p.org_id IS NULL
         AND s.org_id IS NOT NULL;
    $SQL$;
  END IF;

  -- 3b) via invoices (purchases.invoice_id -> invoices.id -> invoices.org_id)
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='purchases' AND column_name='invoice_id'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='invoices' AND column_name='org_id'
  ) THEN
    EXECUTE $SQL$
      UPDATE purchases p
         SET org_id = i.org_id
        FROM invoices i
       WHERE p.invoice_id = i.id
         AND p.org_id IS NULL
         AND i.org_id IS NOT NULL;
    $SQL$;
  END IF;

  -- 3c) via clients (purchases.client_id -> clients.id -> clients.org_id)
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='purchases' AND column_name='client_id'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='clients' AND column_name='org_id'
  ) THEN
    EXECUTE $SQL$
      UPDATE purchases p
         SET org_id = c.org_id
        FROM clients c
       WHERE p.client_id = c.id
         AND p.org_id IS NULL
         AND c.org_id IS NOT NULL;
    $SQL$;
  END IF;

  -- 4) FK para organizations (NOT VALID pra não travar se restarem linhas sem org)
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname='fk_purchases_org_id__organizations_id'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema='public' AND table_name='organizations'
  ) THEN
    BEGIN
      EXECUTE 'ALTER TABLE purchases
                 ADD CONSTRAINT fk_purchases_org_id__organizations_id
                 FOREIGN KEY (org_id) REFERENCES organizations(id)
                 ON DELETE CASCADE NOT VALID;';
      EXECUTE 'ALTER TABLE purchases VALIDATE CONSTRAINT fk_purchases_org_id__organizations_id;';
    EXCEPTION WHEN others THEN NULL;
    END;
  END IF;

  -- 5) Índice composto (org_id, created_at)
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='purchases' AND column_name='org_id'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='purchases' AND column_name='created_at'
  ) THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_purchases_org_created ON purchases (org_id, created_at DESC);';
  END IF;
END $$;

-- USERS
CREATE UNIQUE INDEX IF NOT EXISTS ux_users_email ON users (lower(email));
CREATE INDEX IF NOT EXISTS idx_users_org_id ON users (org_id);

-- ORGANIZATIONS
CREATE UNIQUE INDEX IF NOT EXISTS ux_org_slug ON organizations (slug);
CREATE UNIQUE INDEX IF NOT EXISTS ux_org_email_lower ON organizations (lower(email)) WHERE email IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS ux_org_phone_e164 ON organizations (phone_e164)   WHERE phone_e164 IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS ux_org_document_digits ON organizations ((regexp_replace(COALESCE(document_value,''), '\D','','g')))
  WHERE document_value IS NOT NULL;

-- ORG USERS
CREATE UNIQUE INDEX IF NOT EXISTS ux_org_users_pk ON org_users (org_id, user_id);

-- CONTACTS
CREATE INDEX IF NOT EXISTS idx_contacts_org ON contacts (org_id);
CREATE UNIQUE INDEX IF NOT EXISTS ux_contacts_phone_per_org ON contacts (org_id, phone_e164) WHERE phone_e164 IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS ux_contacts_email_per_org ON contacts (org_id, lower(email)) WHERE email IS NOT NULL;

-- CONVERSATIONS
CREATE INDEX IF NOT EXISTS idx_conversations_org_last ON conversations (org_id, last_message_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS ux_conversations_external ON conversations (org_id, channel, account_id, external_user_id);

-- MESSAGES
CREATE INDEX IF NOT EXISTS idx_messages_conv_created ON messages (conversation_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_org ON messages (org_id);
CREATE UNIQUE INDEX IF NOT EXISTS ux_messages_external_per_org ON messages (org_id, external_message_id) WHERE external_message_id IS NOT NULL;

-- MESSAGE ATTACHMENTS
CREATE UNIQUE INDEX IF NOT EXISTS ux_msg_attachments_idx ON message_attachments (message_id, idx);

-- AI / JSONB (GIN)
CREATE INDEX IF NOT EXISTS idx_org_features_gin ON org_features USING GIN (features);
CREATE INDEX IF NOT EXISTS idx_messages_meta_gin ON messages USING GIN (meta);
CREATE INDEX IF NOT EXISTS idx_channels_config_gin ON channels USING GIN (config);
CREATE INDEX IF NOT EXISTS idx_channels_secrets_gin ON channels USING GIN (secrets);

-- SOCIAL JOBS
CREATE INDEX IF NOT EXISTS idx_instagram_jobs_org ON instagram_publish_jobs (org_id);
CREATE INDEX IF NOT EXISTS idx_instagram_jobs_status ON instagram_publish_jobs (status);
CREATE INDEX IF NOT EXISTS idx_fb_jobs_org_sched ON facebook_publish_jobs (org_id, scheduled_at);
CREATE INDEX IF NOT EXISTS idx_fb_jobs_status ON facebook_publish_jobs (status);

-- TELEMETRIA / RELATÓRIOS
CREATE INDEX IF NOT EXISTS idx_te_org_time ON telemetry_events (org_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_usage_org_meter ON ai_usage (org_id, meter_code, created_at);
CREATE INDEX IF NOT EXISTS idx_invoices_org ON invoices (org_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payments_org_created ON payments (org_id, created_at DESC);


-- função (ok repetir)
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW IS DISTINCT FROM OLD THEN
    NEW.updated_at := now();
  END IF;
  RETURN NEW;
END $$;

-- cria/recua os triggers só em tabelas base do schema public
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT c.table_schema, c.table_name
    FROM information_schema.columns c
    JOIN information_schema.tables  t
      ON t.table_schema = c.table_schema
     AND t.table_name   = c.table_name
    WHERE c.column_name   = 'updated_at'
      AND c.table_schema  = 'public'
      AND t.table_type    = 'BASE TABLE'
  LOOP
    -- drop se existir
    EXECUTE format(
      'DROP TRIGGER IF EXISTS %I ON %I.%I;',
      r.table_name || '_set_updated_at', r.table_schema, r.table_name
    );

    -- cria novamente
    EXECUTE format(
      'CREATE TRIGGER %I
         BEFORE UPDATE ON %I.%I
         FOR EACH ROW EXECUTE FUNCTION set_updated_at();',
      r.table_name || '_set_updated_at', r.table_schema, r.table_name
    );
  END LOOP;
END $$;

-- função
CREATE OR REPLACE FUNCTION bump_conversation_last_message_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  UPDATE conversations
     SET last_message_at = COALESCE(NEW.sent_at, NEW.created_at, now()),
         updated_at      = now()
   WHERE id = NEW.conversation_id;
  RETURN NEW;
END $$;

-- trigger (cria só se existir a tabela messages)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables
             WHERE table_schema='public' AND table_name='messages')
     AND NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='messages_after_insert_bump_last') THEN
    CREATE TRIGGER messages_after_insert_bump_last
      AFTER INSERT ON messages
      FOR EACH ROW EXECUTE FUNCTION bump_conversation_last_message_at();
  END IF;
END $$;

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS unaccent;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS citext;

-- garante a tabela e a coluna 'role'
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema='public' AND table_name='org_users'
  ) THEN
    RAISE EXCEPTION 'Tabela public.org_users não existe';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='org_users' AND column_name='role'
  ) THEN
    EXECUTE 'ALTER TABLE org_users ADD COLUMN role text;';
  END IF;

  -- default + backfill
  EXECUTE 'ALTER TABLE org_users ALTER COLUMN role SET DEFAULT ''OrgViewer'';';
  EXECUTE 'UPDATE org_users SET role = ''OrgViewer'' WHERE role IS NULL;';

  -- índice/PK já podem existir; este é seguro
  EXECUTE 'CREATE UNIQUE INDEX IF NOT EXISTS ux_org_users_pk ON org_users (org_id, user_id);';
END $$;

-- agora o insert funciona
INSERT INTO org_users (org_id, user_id, role)
VALUES ('8f181879-2f22-4831-967a-31c892f271bb','cdbdc333-87d6-4dda-9726-a77f20609b75','OrgOwner')
ON CONFLICT DO NOTHING;


