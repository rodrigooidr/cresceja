--
-- PostgreSQL database dump
--

\restrict cnq6d0maMvIwaPnh42uu7enofA8k0TV7nIJhQVOmhnc3Fs09FV3OZaavIDW8X6P

-- Dumped from database version 16.10
-- Dumped by pg_dump version 16.10

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: citext; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS citext WITH SCHEMA public;


--
-- Name: EXTENSION citext; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION citext IS 'data type for case-insensitive character strings';


--
-- Name: pg_trgm; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA public;


--
-- Name: EXTENSION pg_trgm; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION pg_trgm IS 'text similarity measurement and index searching based on trigrams';


--
-- Name: pgcrypto; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public;


--
-- Name: EXTENSION pgcrypto; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION pgcrypto IS 'cryptographic functions';


--
-- Name: unaccent; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS unaccent WITH SCHEMA public;


--
-- Name: EXTENSION unaccent; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION unaccent IS 'text search dictionary that removes accents';


--
-- Name: uuid-ossp; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA public;


--
-- Name: EXTENSION "uuid-ossp"; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION "uuid-ossp" IS 'generate universally unique identifiers (UUIDs)';


--
-- Name: instagram_publish_status; Type: TYPE; Schema: public; Owner: cresceja
--

CREATE TYPE public.instagram_publish_status AS ENUM (
    'pending',
    'creating',
    'ready',
    'publishing',
    'done',
    'failed',
    'canceled'
);


ALTER TYPE public.instagram_publish_status OWNER TO cresceja;

--
-- Name: bump_conversation_last_message_at(); Type: FUNCTION; Schema: public; Owner: cresceja
--

CREATE FUNCTION public.bump_conversation_last_message_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  UPDATE conversations
     SET last_message_at = COALESCE(NEW.sent_at, NEW.created_at, now()),
         updated_at      = now()
   WHERE id = NEW.conversation_id;
  RETURN NEW;
END $$;


ALTER FUNCTION public.bump_conversation_last_message_at() OWNER TO cresceja;

--
-- Name: col_exists(text, text); Type: FUNCTION; Schema: public; Owner: cresceja
--

CREATE FUNCTION public.col_exists(p_table text, p_column text) RETURNS boolean
    LANGUAGE sql STABLE
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema='public'
      AND table_name=p_table
      AND column_name=p_column
  )
$$;


ALTER FUNCTION public.col_exists(p_table text, p_column text) OWNER TO cresceja;

--
-- Name: insert_org_dynamic(uuid, text, text, text, text); Type: FUNCTION; Schema: public; Owner: cresceja
--

CREATE FUNCTION public.insert_org_dynamic(p_id uuid, p_name text, p_slug text, p_status text, p_plan_code text) RETURNS void
    LANGUAGE plpgsql
    AS $$
DECLARE
  col_list text := '';
  val_list text := '';
  sep text := '';
  has_slug    boolean := public.col_exists('organizations','slug');
  has_status  boolean := public.col_exists('organizations','status');
  has_plan_id boolean := public.col_exists('organizations','plan_id');
  plan_id uuid := NULL;
BEGIN
  IF has_plan_id AND p_plan_code IS NOT NULL AND public.col_exists('plans','code') THEN
    EXECUTE format('SELECT id FROM plans WHERE code=%L LIMIT 1', p_plan_code) INTO plan_id;
  END IF;

  IF public.col_exists('organizations','id') THEN
    col_list := col_list || sep || 'id';    val_list := val_list || sep || quote_literal(p_id); sep := ',';
  END IF;
  IF public.col_exists('organizations','name') THEN
    col_list := col_list || sep || 'name';  val_list := val_list || sep || quote_literal(p_name); sep := ',';
  END IF;
  IF has_slug AND p_slug IS NOT NULL THEN
    col_list := col_list || sep || 'slug';  val_list := val_list || sep || quote_literal(p_slug); sep := ',';
  END IF;
  IF has_status AND p_status IS NOT NULL THEN
    col_list := col_list || sep || 'status'; val_list := val_list || sep || quote_literal(p_status); sep := ',';
  END IF;
  IF has_plan_id AND plan_id IS NOT NULL THEN
    col_list := col_list || sep || 'plan_id'; val_list := val_list || sep || quote_literal(plan_id::text); sep := ',';
  END IF;

  -- insere se não existir este id
  IF NOT EXISTS (SELECT 1 FROM organizations WHERE id = p_id) THEN
    EXECUTE format('INSERT INTO organizations (%s) VALUES (%s);', col_list, val_list);
  ELSE
    -- atualiza nome/slug/status/plan_id se existirem
    IF public.col_exists('organizations','name') THEN
      EXECUTE format('UPDATE organizations SET name=%L WHERE id=%L;', p_name, p_id);
    END IF;
    IF has_slug AND p_slug IS NOT NULL THEN
      EXECUTE format('UPDATE organizations SET slug=%L WHERE id=%L;', p_slug, p_id);
    END IF;
    IF has_status AND p_status IS NOT NULL THEN
      EXECUTE format('UPDATE organizations SET status=%L WHERE id=%L;', p_status, p_id);
    END IF;
    IF has_plan_id AND plan_id IS NOT NULL THEN
      EXECUTE format('UPDATE organizations SET plan_id=%L WHERE id=%L;', plan_id, p_id);
    END IF;
  END IF;
END
$$;


ALTER FUNCTION public.insert_org_dynamic(p_id uuid, p_name text, p_slug text, p_status text, p_plan_code text) OWNER TO cresceja;

--
-- Name: insert_plan_dynamic(uuid, text, text, integer, text); Type: FUNCTION; Schema: public; Owner: cresceja
--

CREATE FUNCTION public.insert_plan_dynamic(p_id uuid, p_name text, p_code text, p_price_cents integer, p_currency text) RETURNS void
    LANGUAGE plpgsql
    AS $$
DECLARE
  col_list text := '';
  val_list text := '';
  sep text := '';
  price_col text := NULL;
  curr_col  text := NULL;
  has_code  boolean := public.col_exists('plans','code');
  exists_by_code boolean := false;
BEGIN
  -- identificar a melhor coluna de preço entre as que existirem
  FOR price_col IN SELECT unnest(ARRAY[
    'price_cents','amount_cents','monthly_price_cents','price_monthly_cents','price'
  ])
  LOOP
    EXIT WHEN public.col_exists('plans', price_col);
    price_col := NULL; -- continua procurando
  END LOOP;

  -- identificar coluna de moeda
  FOR curr_col IN SELECT unnest(ARRAY['currency','currency_code'])
  LOOP
    EXIT WHEN public.col_exists('plans', curr_col);
    curr_col := NULL;
  END LOOP;

  -- montar listas dinamicamente
  IF public.col_exists('plans','id') THEN
    col_list := col_list || sep || 'id';          val_list := val_list || sep || quote_literal(p_id); sep := ',';
  END IF;
  IF public.col_exists('plans','name') THEN
    col_list := col_list || sep || 'name';        val_list := val_list || sep || quote_literal(p_name); sep := ',';
  END IF;
  IF has_code THEN
    col_list := col_list || sep || 'code';        val_list := val_list || sep || quote_literal(p_code); sep := ',';
  END IF;
  IF price_col IS NOT NULL AND p_price_cents IS NOT NULL THEN
    col_list := col_list || sep || quote_ident(price_col);
    val_list := val_list || sep || p_price_cents::text; sep := ',';
  END IF;
  IF curr_col IS NOT NULL AND p_currency IS NOT NULL THEN
    col_list := col_list || sep || quote_ident(curr_col);
    val_list := val_list || sep || quote_literal(p_currency); sep := ',';
  END IF;

  -- já existe?
  IF has_code THEN
    EXECUTE format('SELECT EXISTS(SELECT 1 FROM plans WHERE code=%L)', p_code) INTO exists_by_code;
  END IF;

  IF (has_code AND NOT exists_by_code)
     OR (NOT has_code AND public.col_exists('plans','id') AND NOT EXISTS (SELECT 1 FROM plans WHERE id = p_id))
  THEN
    EXECUTE format('INSERT INTO plans (%s) VALUES (%s);', col_list, val_list);
  ELSE
    -- Atualiza campos básicos quando possível
    IF public.col_exists('plans','name') THEN
      EXECUTE format('UPDATE plans SET name=%L WHERE %s', p_name,
        CASE WHEN has_code THEN format('code=%L', p_code) ELSE format('id=%L', p_id) END);
    END IF;
    IF price_col IS NOT NULL AND p_price_cents IS NOT NULL THEN
      EXECUTE format('UPDATE plans SET %I=%s WHERE %s',
        price_col, p_price_cents::text,
        CASE WHEN has_code THEN format('code=%L', p_code) ELSE format('id=%L', p_id) END);
    END IF;
    IF curr_col IS NOT NULL AND p_currency IS NOT NULL THEN
      EXECUTE format('UPDATE plans SET %I=%L WHERE %s',
        curr_col, p_currency,
        CASE WHEN has_code THEN format('code=%L', p_code) ELSE format('id=%L', p_id) END);
    END IF;
  END IF;
END
$$;


ALTER FUNCTION public.insert_plan_dynamic(p_id uuid, p_name text, p_code text, p_price_cents integer, p_currency text) OWNER TO cresceja;

--
-- Name: set_timestamp(); Type: FUNCTION; Schema: public; Owner: cresceja
--

CREATE FUNCTION public.set_timestamp() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF NEW IS DISTINCT FROM OLD THEN
    NEW.updated_at := NOW();
  END IF;
  RETURN NEW;
END $$;


ALTER FUNCTION public.set_timestamp() OWNER TO cresceja;

--
-- Name: set_updated_at(); Type: FUNCTION; Schema: public; Owner: cresceja
--

CREATE FUNCTION public.set_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF NEW IS DISTINCT FROM OLD THEN
    NEW.updated_at := now();
  END IF;
  RETURN NEW;
END $$;


ALTER FUNCTION public.set_updated_at() OWNER TO cresceja;

--
-- Name: sync_messages_status_from_event(); Type: FUNCTION; Schema: public; Owner: cresceja
--

CREATE FUNCTION public.sync_messages_status_from_event() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  UPDATE messages SET status = NEW.status WHERE id = NEW.message_id;
  RETURN NEW;
END $$;


ALTER FUNCTION public.sync_messages_status_from_event() OWNER TO cresceja;

--
-- Name: tg_set_updated_at(); Type: FUNCTION; Schema: public; Owner: cresceja
--

CREATE FUNCTION public.tg_set_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF NEW IS DISTINCT FROM OLD THEN
    NEW.updated_at := NOW();
  END IF;
  RETURN NEW;
END $$;


ALTER FUNCTION public.tg_set_updated_at() OWNER TO cresceja;

--
-- Name: try_parse_jsonb(text); Type: FUNCTION; Schema: public; Owner: cresceja
--

CREATE FUNCTION public.try_parse_jsonb(t text) RETURNS jsonb
    LANGUAGE plpgsql IMMUTABLE STRICT
    AS $$
BEGIN
  RETURN t::jsonb;
EXCEPTION WHEN others THEN
  RETURN NULL;
END
$$;


ALTER FUNCTION public.try_parse_jsonb(t text) OWNER TO cresceja;

--
-- Name: util_br_e164(text); Type: FUNCTION; Schema: public; Owner: cresceja
--

CREATE FUNCTION public.util_br_e164(text) RETURNS text
    LANGUAGE sql IMMUTABLE STRICT PARALLEL SAFE
    AS $_$ 
  SELECT CASE 
    WHEN $1 IS NULL THEN NULL
    ELSE '+' || regexp_replace(regexp_replace($1, '\D', '', 'g'), '^(?!55)', '55')
  END;
$_$;


ALTER FUNCTION public.util_br_e164(text) OWNER TO cresceja;

--
-- Name: util_digits(text); Type: FUNCTION; Schema: public; Owner: cresceja
--

CREATE FUNCTION public.util_digits(text) RETURNS text
    LANGUAGE sql IMMUTABLE STRICT PARALLEL SAFE
    AS $_$ SELECT regexp_replace($1, '\D', '', 'g') $_$;


ALTER FUNCTION public.util_digits(text) OWNER TO cresceja;

--
-- Name: util_email_lower(text); Type: FUNCTION; Schema: public; Owner: cresceja
--

CREATE FUNCTION public.util_email_lower(text) RETURNS text
    LANGUAGE sql IMMUTABLE STRICT PARALLEL SAFE
    AS $_$ SELECT lower($1) $_$;


ALTER FUNCTION public.util_email_lower(text) OWNER TO cresceja;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: ai_credit_usage; Type: TABLE; Schema: public; Owner: cresceja
--

CREATE TABLE public.ai_credit_usage (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    category text,
    org_id uuid,
    period_start timestamp with time zone,
    user_id uuid
);


ALTER TABLE public.ai_credit_usage OWNER TO cresceja;

--
-- Name: ai_guardrail_violations; Type: TABLE; Schema: public; Owner: cresceja
--

CREATE TABLE public.ai_guardrail_violations (
    channel text,
    created_at timestamp with time zone DEFAULT now(),
    created_by text,
    id uuid DEFAULT public.gen_random_uuid() NOT NULL,
    input_excerpt text,
    intent text,
    message text,
    org_id uuid DEFAULT public.gen_random_uuid(),
    output_excerpt text,
    payload text,
    rule text,
    stage text,
    updated_at timestamp with time zone DEFAULT now(),
    user_id uuid DEFAULT public.gen_random_uuid()
);


ALTER TABLE public.ai_guardrail_violations OWNER TO cresceja;

--
-- Name: ai_meters; Type: TABLE; Schema: public; Owner: cresceja
--

CREATE TABLE public.ai_meters (
    code text,
    created_at timestamp with time zone DEFAULT now(),
    id uuid DEFAULT public.gen_random_uuid() NOT NULL,
    name text,
    unit text,
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.ai_meters OWNER TO cresceja;

--
-- Name: ai_usage; Type: TABLE; Schema: public; Owner: cresceja
--

CREATE TABLE public.ai_usage (
    created_at timestamp with time zone DEFAULT now(),
    id uuid DEFAULT public.gen_random_uuid() NOT NULL,
    meta text,
    meter_code text,
    org_id uuid DEFAULT public.gen_random_uuid(),
    qty text,
    source text,
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.ai_usage OWNER TO cresceja;

--
-- Name: ai_usage_logs; Type: TABLE; Schema: public; Owner: cresceja
--

CREATE TABLE public.ai_usage_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL
);


ALTER TABLE public.ai_usage_logs OWNER TO cresceja;

--
-- Name: assets; Type: TABLE; Schema: public; Owner: cresceja
--

CREATE TABLE public.assets (
    id uuid DEFAULT gen_random_uuid() NOT NULL
);


ALTER TABLE public.assets OWNER TO cresceja;

--
-- Name: audit_logs; Type: TABLE; Schema: public; Owner: cresceja
--

CREATE TABLE public.audit_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL
);


ALTER TABLE public.audit_logs OWNER TO cresceja;

--
-- Name: calendar_events; Type: TABLE; Schema: public; Owner: cresceja
--

CREATE TABLE public.calendar_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL
);


ALTER TABLE public.calendar_events OWNER TO cresceja;

--
-- Name: calendar_members; Type: TABLE; Schema: public; Owner: cresceja
--

CREATE TABLE public.calendar_members (
    id uuid DEFAULT gen_random_uuid() NOT NULL
);


ALTER TABLE public.calendar_members OWNER TO cresceja;

--
-- Name: calendars; Type: TABLE; Schema: public; Owner: cresceja
--

CREATE TABLE public.calendars (
    id uuid DEFAULT gen_random_uuid() NOT NULL
);


ALTER TABLE public.calendars OWNER TO cresceja;

--
-- Name: channel_accounts; Type: TABLE; Schema: public; Owner: cresceja
--

CREATE TABLE public.channel_accounts (
    channel text,
    external_account_id uuid,
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    org_id uuid
);


ALTER TABLE public.channel_accounts OWNER TO cresceja;

--
-- Name: channel_id_map; Type: TABLE; Schema: public; Owner: cresceja
--

CREATE TABLE public.channel_id_map (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    channel_type text,
    external_id uuid,
    org_id uuid
);


ALTER TABLE public.channel_id_map OWNER TO cresceja;

--
-- Name: channels; Type: TABLE; Schema: public; Owner: cresceja
--

CREATE TABLE public.channels (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    mode text,
    org_id uuid,
    type text,
    config jsonb DEFAULT '{}'::jsonb,
    secrets jsonb DEFAULT '{}'::jsonb
);


ALTER TABLE public.channels OWNER TO cresceja;

--
-- Name: clients; Type: TABLE; Schema: public; Owner: cresceja
--

CREATE TABLE public.clients (
    id uuid DEFAULT public.gen_random_uuid() NOT NULL,
    org_id uuid
);


ALTER TABLE public.clients OWNER TO cresceja;

--
-- Name: contact_identities; Type: TABLE; Schema: public; Owner: cresceja
--

CREATE TABLE public.contact_identities (
    account_id uuid,
    channel text,
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    identity text,
    org_id uuid
);


ALTER TABLE public.contact_identities OWNER TO cresceja;

--
-- Name: contact_tags; Type: TABLE; Schema: public; Owner: cresceja
--

CREATE TABLE public.contact_tags (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    contact_id uuid,
    tag_id uuid
);


ALTER TABLE public.contact_tags OWNER TO cresceja;

--
-- Name: contacts; Type: TABLE; Schema: public; Owner: cresceja
--

CREATE TABLE public.contacts (
    id uuid DEFAULT public.gen_random_uuid() NOT NULL,
    org_id uuid,
    phone_e164 text,
    email text
);


ALTER TABLE public.contacts OWNER TO cresceja;

--
-- Name: content_assets; Type: TABLE; Schema: public; Owner: cresceja
--

CREATE TABLE public.content_assets (
    id uuid DEFAULT gen_random_uuid() NOT NULL
);


ALTER TABLE public.content_assets OWNER TO cresceja;

--
-- Name: content_campaigns; Type: TABLE; Schema: public; Owner: cresceja
--

CREATE TABLE public.content_campaigns (
    id uuid DEFAULT gen_random_uuid() NOT NULL
);


ALTER TABLE public.content_campaigns OWNER TO cresceja;

--
-- Name: content_suggestions; Type: TABLE; Schema: public; Owner: cresceja
--

CREATE TABLE public.content_suggestions (
    id uuid DEFAULT gen_random_uuid() NOT NULL
);


ALTER TABLE public.content_suggestions OWNER TO cresceja;

--
-- Name: conversations; Type: TABLE; Schema: public; Owner: cresceja
--

CREATE TABLE public.conversations (
    account_id uuid,
    channel text,
    chat_id uuid,
    external_user_id uuid,
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    org_id uuid,
    transport text,
    last_message_at timestamp with time zone
);


ALTER TABLE public.conversations OWNER TO cresceja;

--
-- Name: crm_opportunities; Type: TABLE; Schema: public; Owner: cresceja
--

CREATE TABLE public.crm_opportunities (
    id uuid DEFAULT gen_random_uuid() NOT NULL
);


ALTER TABLE public.crm_opportunities OWNER TO cresceja;

--
-- Name: email_automation_steps; Type: TABLE; Schema: public; Owner: cresceja
--

CREATE TABLE public.email_automation_steps (
    id uuid DEFAULT gen_random_uuid() NOT NULL
);


ALTER TABLE public.email_automation_steps OWNER TO cresceja;

--
-- Name: email_automations; Type: TABLE; Schema: public; Owner: cresceja
--

CREATE TABLE public.email_automations (
    id uuid DEFAULT gen_random_uuid() NOT NULL
);


ALTER TABLE public.email_automations OWNER TO cresceja;

--
-- Name: email_campaign_recipients; Type: TABLE; Schema: public; Owner: cresceja
--

CREATE TABLE public.email_campaign_recipients (
    id uuid DEFAULT gen_random_uuid() NOT NULL
);


ALTER TABLE public.email_campaign_recipients OWNER TO cresceja;

--
-- Name: email_campaigns; Type: TABLE; Schema: public; Owner: cresceja
--

CREATE TABLE public.email_campaigns (
    id uuid DEFAULT gen_random_uuid() NOT NULL
);


ALTER TABLE public.email_campaigns OWNER TO cresceja;

--
-- Name: email_events; Type: TABLE; Schema: public; Owner: cresceja
--

CREATE TABLE public.email_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL
);


ALTER TABLE public.email_events OWNER TO cresceja;

--
-- Name: email_lists; Type: TABLE; Schema: public; Owner: cresceja
--

CREATE TABLE public.email_lists (
    id uuid DEFAULT gen_random_uuid() NOT NULL
);


ALTER TABLE public.email_lists OWNER TO cresceja;

--
-- Name: email_subscriptions; Type: TABLE; Schema: public; Owner: cresceja
--

CREATE TABLE public.email_subscriptions (
    email text,
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    list_id uuid,
    org_id uuid
);


ALTER TABLE public.email_subscriptions OWNER TO cresceja;

--
-- Name: email_suppressions; Type: TABLE; Schema: public; Owner: cresceja
--

CREATE TABLE public.email_suppressions (
    "UNIQUE" text,
    created_at timestamp with time zone DEFAULT now(),
    email public.citext,
    id uuid DEFAULT public.gen_random_uuid() NOT NULL,
    org_id uuid DEFAULT public.gen_random_uuid(),
    reason text,
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.email_suppressions OWNER TO cresceja;

--
-- Name: email_templates; Type: TABLE; Schema: public; Owner: cresceja
--

CREATE TABLE public.email_templates (
    id uuid DEFAULT gen_random_uuid() NOT NULL
);


ALTER TABLE public.email_templates OWNER TO cresceja;

--
-- Name: facebook_oauth_tokens; Type: TABLE; Schema: public; Owner: cresceja
--

CREATE TABLE public.facebook_oauth_tokens (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    page_id uuid
);


ALTER TABLE public.facebook_oauth_tokens OWNER TO cresceja;

--
-- Name: facebook_pages; Type: TABLE; Schema: public; Owner: cresceja
--

CREATE TABLE public.facebook_pages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    org_id uuid,
    page_id uuid
);


ALTER TABLE public.facebook_pages OWNER TO cresceja;

--
-- Name: facebook_publish_jobs; Type: TABLE; Schema: public; Owner: cresceja
--

CREATE TABLE public.facebook_publish_jobs (
    id uuid DEFAULT public.gen_random_uuid() NOT NULL,
    org_id uuid,
    page_id uuid,
    status text DEFAULT 'pending'::text,
    scheduled_at timestamp with time zone,
    CONSTRAINT chk_fb_jobs_status_domain CHECK ((status = ANY (ARRAY['pending'::text, 'creating'::text, 'ready'::text, 'publishing'::text, 'done'::text, 'failed'::text, 'canceled'::text])))
);


ALTER TABLE public.facebook_publish_jobs OWNER TO cresceja;

--
-- Name: feature_defs; Type: TABLE; Schema: public; Owner: cresceja
--

CREATE TABLE public.feature_defs (
    code text,
    id uuid DEFAULT gen_random_uuid() NOT NULL
);


ALTER TABLE public.feature_defs OWNER TO cresceja;

--
-- Name: google_calendar_accounts; Type: TABLE; Schema: public; Owner: cresceja
--

CREATE TABLE public.google_calendar_accounts (
    google_user_id uuid,
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    org_id uuid
);


ALTER TABLE public.google_calendar_accounts OWNER TO cresceja;

--
-- Name: google_oauth_tokens; Type: TABLE; Schema: public; Owner: cresceja
--

CREATE TABLE public.google_oauth_tokens (
    id uuid DEFAULT gen_random_uuid() NOT NULL
);


ALTER TABLE public.google_oauth_tokens OWNER TO cresceja;

--
-- Name: inbox_ai_flags; Type: TABLE; Schema: public; Owner: cresceja
--

CREATE TABLE public.inbox_ai_flags (
    conversation_id uuid DEFAULT public.gen_random_uuid(),
    created_at timestamp with time zone DEFAULT now(),
    flag text,
    id uuid DEFAULT public.gen_random_uuid() NOT NULL,
    org_id uuid DEFAULT public.gen_random_uuid(),
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.inbox_ai_flags OWNER TO cresceja;

--
-- Name: inbox_audit_events; Type: TABLE; Schema: public; Owner: cresceja
--

CREATE TABLE public.inbox_audit_events (
    action text,
    actor_id uuid DEFAULT public.gen_random_uuid(),
    created_at timestamp with time zone DEFAULT now(),
    id uuid DEFAULT public.gen_random_uuid() NOT NULL,
    meta text,
    org_id uuid DEFAULT public.gen_random_uuid(),
    target_id uuid DEFAULT public.gen_random_uuid(),
    target_type text,
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.inbox_audit_events OWNER TO cresceja;

--
-- Name: inbox_idempotency; Type: TABLE; Schema: public; Owner: cresceja
--

CREATE TABLE public.inbox_idempotency (
    created_at timestamp with time zone DEFAULT now(),
    id uuid DEFAULT public.gen_random_uuid() NOT NULL,
    key text,
    ttl text,
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.inbox_idempotency OWNER TO cresceja;

--
-- Name: information_schema; Type: TABLE; Schema: public; Owner: cresceja
--

CREATE TABLE public.information_schema (
    created_at timestamp with time zone DEFAULT now(),
    id uuid DEFAULT public.gen_random_uuid() NOT NULL,
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.information_schema OWNER TO cresceja;

--
-- Name: instagram_accounts; Type: TABLE; Schema: public; Owner: cresceja
--

CREATE TABLE public.instagram_accounts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    ig_user_id uuid,
    org_id uuid
);


ALTER TABLE public.instagram_accounts OWNER TO cresceja;

--
-- Name: instagram_oauth_tokens; Type: TABLE; Schema: public; Owner: cresceja
--

CREATE TABLE public.instagram_oauth_tokens (
    account_id uuid,
    id uuid DEFAULT gen_random_uuid() NOT NULL
);


ALTER TABLE public.instagram_oauth_tokens OWNER TO cresceja;

--
-- Name: instagram_publish_jobs; Type: TABLE; Schema: public; Owner: cresceja
--

CREATE TABLE public.instagram_publish_jobs (
    account_id uuid,
    client_dedupe_key text,
    id uuid DEFAULT public.gen_random_uuid() NOT NULL,
    org_id uuid,
    status public.instagram_publish_status DEFAULT 'pending'::public.instagram_publish_status NOT NULL
);


ALTER TABLE public.instagram_publish_jobs OWNER TO cresceja;

--
-- Name: integration_events; Type: TABLE; Schema: public; Owner: cresceja
--

CREATE TABLE public.integration_events (
    created_at timestamp with time zone DEFAULT now(),
    event_type text,
    id uuid DEFAULT public.gen_random_uuid() NOT NULL,
    org_id uuid DEFAULT public.gen_random_uuid(),
    payload text,
    provider text,
    received_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.integration_events OWNER TO cresceja;

--
-- Name: invoices; Type: TABLE; Schema: public; Owner: cresceja
--

CREATE TABLE public.invoices (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    org_id uuid,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.invoices OWNER TO cresceja;

--
-- Name: kb_documents; Type: TABLE; Schema: public; Owner: cresceja
--

CREATE TABLE public.kb_documents (
    active text,
    checksum text,
    created_at timestamp with time zone DEFAULT now(),
    id uuid DEFAULT public.gen_random_uuid() NOT NULL,
    lang text,
    meta text,
    org_id uuid DEFAULT public.gen_random_uuid(),
    source_type text,
    tags text[] DEFAULT ARRAY[]::text[],
    title text,
    updated_at timestamp with time zone DEFAULT now(),
    uri text
);


ALTER TABLE public.kb_documents OWNER TO cresceja;

--
-- Name: leads; Type: TABLE; Schema: public; Owner: cresceja
--

CREATE TABLE public.leads (
    id uuid DEFAULT public.gen_random_uuid() NOT NULL,
    org_id uuid
);


ALTER TABLE public.leads OWNER TO cresceja;

--
-- Name: lgpd_consents; Type: TABLE; Schema: public; Owner: cresceja
--

CREATE TABLE public.lgpd_consents (
    id uuid DEFAULT gen_random_uuid() NOT NULL
);


ALTER TABLE public.lgpd_consents OWNER TO cresceja;

--
-- Name: lgpd_erasure_requests; Type: TABLE; Schema: public; Owner: cresceja
--

CREATE TABLE public.lgpd_erasure_requests (
    id uuid DEFAULT gen_random_uuid() NOT NULL
);


ALTER TABLE public.lgpd_erasure_requests OWNER TO cresceja;

--
-- Name: message_attachments; Type: TABLE; Schema: public; Owner: cresceja
--

CREATE TABLE public.message_attachments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    idx text,
    message_id uuid
);


ALTER TABLE public.message_attachments OWNER TO cresceja;

--
-- Name: message_status_events; Type: TABLE; Schema: public; Owner: cresceja
--

CREATE TABLE public.message_status_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL
);


ALTER TABLE public.message_status_events OWNER TO cresceja;

--
-- Name: message_templates; Type: TABLE; Schema: public; Owner: cresceja
--

CREATE TABLE public.message_templates (
    id uuid DEFAULT gen_random_uuid() NOT NULL
);


ALTER TABLE public.message_templates OWNER TO cresceja;

--
-- Name: message_transcripts; Type: TABLE; Schema: public; Owner: cresceja
--

CREATE TABLE public.message_transcripts (
    id uuid DEFAULT gen_random_uuid() NOT NULL
);


ALTER TABLE public.message_transcripts OWNER TO cresceja;

--
-- Name: messages; Type: TABLE; Schema: public; Owner: cresceja
--

CREATE TABLE public.messages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    org_id uuid,
    conversation_id uuid,
    channel text NOT NULL,
    direction text NOT NULL,
    external_message_id text,
    sender_id uuid,
    sender_name text,
    sender_role text,
    content text,
    content_type text DEFAULT 'text'::text,
    attachments jsonb DEFAULT '[]'::jsonb NOT NULL,
    meta jsonb DEFAULT '{}'::jsonb NOT NULL,
    status text DEFAULT 'queued'::text NOT NULL,
    error text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    sent_at timestamp with time zone,
    delivered_at timestamp with time zone,
    read_at timestamp with time zone,
    CONSTRAINT messages_direction_check CHECK ((direction = ANY (ARRAY['in'::text, 'out'::text]))),
    CONSTRAINT messages_status_check CHECK ((status = ANY (ARRAY['queued'::text, 'sent'::text, 'delivered'::text, 'read'::text, 'failed'::text, 'received'::text])))
);


ALTER TABLE public.messages OWNER TO cresceja;

--
-- Name: meta_tokens; Type: TABLE; Schema: public; Owner: cresceja
--

CREATE TABLE public.meta_tokens (
    id uuid DEFAULT public.gen_random_uuid() NOT NULL,
    org_id uuid NOT NULL,
    token text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.meta_tokens OWNER TO cresceja;

--
-- Name: nps_responses; Type: TABLE; Schema: public; Owner: cresceja
--

CREATE TABLE public.nps_responses (
    id uuid DEFAULT gen_random_uuid() NOT NULL
);


ALTER TABLE public.nps_responses OWNER TO cresceja;

--
-- Name: nps_surveys; Type: TABLE; Schema: public; Owner: cresceja
--

CREATE TABLE public.nps_surveys (
    id uuid DEFAULT gen_random_uuid() NOT NULL
);


ALTER TABLE public.nps_surveys OWNER TO cresceja;

--
-- Name: onboarding_tasks; Type: TABLE; Schema: public; Owner: cresceja
--

CREATE TABLE public.onboarding_tasks (
    id uuid DEFAULT gen_random_uuid() NOT NULL
);


ALTER TABLE public.onboarding_tasks OWNER TO cresceja;

--
-- Name: opportunities; Type: TABLE; Schema: public; Owner: cresceja
--

CREATE TABLE public.opportunities (
    "${fields.join('" text,
    "')}" text,
    "[id" text,
    cliente text,
    created_at timestamp with time zone DEFAULT now(),
    id uuid DEFAULT public.gen_random_uuid() NOT NULL,
    lead_id uuid DEFAULT public.gen_random_uuid(),
    org_id uuid DEFAULT public.gen_random_uuid(),
    "req.orgId]
    )" text,
    responsavel text,
    sem text,
    status text,
    updated_at timestamp with time zone DEFAULT now(),
    valor_estimado text,
    "values
    )" text
);


ALTER TABLE public.opportunities OWNER TO cresceja;

--
-- Name: org_ai_profiles; Type: TABLE; Schema: public; Owner: cresceja
--

CREATE TABLE public.org_ai_profiles (
    created_at timestamp with time zone DEFAULT now(),
    id uuid DEFAULT public.gen_random_uuid() NOT NULL,
    org_id uuid DEFAULT public.gen_random_uuid(),
    profile text,
    updated_at timestamp with time zone DEFAULT now(),
    updated_by text
);


ALTER TABLE public.org_ai_profiles OWNER TO cresceja;

--
-- Name: org_ai_settings; Type: TABLE; Schema: public; Owner: cresceja
--

CREATE TABLE public.org_ai_settings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    org_id uuid
);


ALTER TABLE public.org_ai_settings OWNER TO cresceja;

--
-- Name: org_credits; Type: TABLE; Schema: public; Owner: cresceja
--

CREATE TABLE public.org_credits (
    created_at timestamp with time zone DEFAULT now(),
    delta text,
    expires_at text,
    feature_code text,
    id uuid DEFAULT public.gen_random_uuid() NOT NULL,
    meta text,
    org_id uuid DEFAULT public.gen_random_uuid(),
    source text,
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.org_credits OWNER TO cresceja;

--
-- Name: org_features; Type: TABLE; Schema: public; Owner: cresceja
--

CREATE TABLE public.org_features (
    created_at timestamp with time zone DEFAULT now(),
    id uuid DEFAULT public.gen_random_uuid() NOT NULL,
    org_id uuid DEFAULT public.gen_random_uuid(),
    updated_at timestamp with time zone DEFAULT now(),
    features jsonb,
    features_jsonb jsonb
);


ALTER TABLE public.org_features OWNER TO cresceja;

--
-- Name: org_integration_logs; Type: TABLE; Schema: public; Owner: cresceja
--

CREATE TABLE public.org_integration_logs (
    created_at timestamp with time zone DEFAULT now(),
    event text,
    id uuid DEFAULT public.gen_random_uuid() NOT NULL,
    ok text,
    org_id uuid DEFAULT public.gen_random_uuid(),
    payload text,
    provider text,
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.org_integration_logs OWNER TO cresceja;

--
-- Name: org_integrations; Type: TABLE; Schema: public; Owner: cresceja
--

CREATE TABLE public.org_integrations (
    "${fields.join('" text,
    "')}
     WHERE org_id" uuid DEFAULT public.gen_random_uuid(),
    "UNIQUE" text,
    created_at timestamp with time zone DEFAULT now(),
    creds text,
    id uuid DEFAULT public.gen_random_uuid() NOT NULL,
    meta text,
    org_id uuid DEFAULT public.gen_random_uuid(),
    provider text,
    status text,
    subscribed text,
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.org_integrations OWNER TO cresceja;

--
-- Name: org_plan_history; Type: TABLE; Schema: public; Owner: cresceja
--

CREATE TABLE public.org_plan_history (
    "PRIMARY" text,
    created_at timestamp with time zone DEFAULT now(),
    end_at text,
    id uuid DEFAULT public.gen_random_uuid() NOT NULL,
    meta text,
    org_id uuid DEFAULT public.gen_random_uuid(),
    plan_id uuid DEFAULT public.gen_random_uuid(),
    source text,
    start_at text,
    status text,
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.org_plan_history OWNER TO cresceja;

--
-- Name: org_settings; Type: TABLE; Schema: public; Owner: cresceja
--

CREATE TABLE public.org_settings (
    ")" text,
    "[orgId]" text,
    "[orgId])" text,
    ai_enabled boolean DEFAULT false,
    ai_handoff_keywords text,
    ai_max_turns_before_handoff text,
    alert_sound text,
    alert_volume text,
    allow_baileys text,
    business_hours text,
    created_at timestamp with time zone DEFAULT now(),
    id uuid DEFAULT public.gen_random_uuid() NOT NULL,
    org_id uuid DEFAULT public.gen_random_uuid(),
    templates_enabled_channels text,
    updated_at timestamp with time zone DEFAULT now(),
    whatsapp_active_mode text
);


ALTER TABLE public.org_settings OWNER TO cresceja;

--
-- Name: org_subscriptions; Type: TABLE; Schema: public; Owner: cresceja
--

CREATE TABLE public.org_subscriptions (
    created_at timestamp with time zone DEFAULT now(),
    id uuid DEFAULT public.gen_random_uuid() NOT NULL,
    org_id uuid DEFAULT public.gen_random_uuid(),
    period text,
    plan_id uuid DEFAULT public.gen_random_uuid(),
    trial_end text,
    trial_start text,
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.org_subscriptions OWNER TO cresceja;

--
-- Name: org_users; Type: TABLE; Schema: public; Owner: cresceja
--

CREATE TABLE public.org_users (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    org_id uuid,
    user_id uuid,
    role text DEFAULT 'OrgViewer'::text
);


ALTER TABLE public.org_users OWNER TO cresceja;

--
-- Name: organizations; Type: TABLE; Schema: public; Owner: cresceja
--

CREATE TABLE public.organizations (
    id uuid NOT NULL,
    name text,
    slug text,
    status text,
    plan_id uuid,
    trial_ends_at timestamp with time zone,
    email text,
    phone text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    phone_e164 text,
    document_value text
);


ALTER TABLE public.organizations OWNER TO cresceja;

--
-- Name: payments; Type: TABLE; Schema: public; Owner: cresceja
--

CREATE TABLE public.payments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    org_id uuid,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.payments OWNER TO cresceja;

--
-- Name: pg_attribute; Type: TABLE; Schema: public; Owner: cresceja
--

CREATE TABLE public.pg_attribute (
    created_at timestamp with time zone DEFAULT now(),
    id uuid DEFAULT public.gen_random_uuid() NOT NULL,
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.pg_attribute OWNER TO cresceja;

--
-- Name: pg_class; Type: TABLE; Schema: public; Owner: cresceja
--

CREATE TABLE public.pg_class (
    created_at timestamp with time zone DEFAULT now(),
    id uuid DEFAULT public.gen_random_uuid() NOT NULL,
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.pg_class OWNER TO cresceja;

--
-- Name: pg_constraint; Type: TABLE; Schema: public; Owner: cresceja
--

CREATE TABLE public.pg_constraint (
    created_at timestamp with time zone DEFAULT now(),
    id uuid DEFAULT public.gen_random_uuid() NOT NULL,
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.pg_constraint OWNER TO cresceja;

--
-- Name: pg_indexes; Type: TABLE; Schema: public; Owner: cresceja
--

CREATE TABLE public.pg_indexes (
    created_at timestamp with time zone DEFAULT now(),
    id uuid DEFAULT public.gen_random_uuid() NOT NULL,
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.pg_indexes OWNER TO cresceja;

--
-- Name: pg_proc; Type: TABLE; Schema: public; Owner: cresceja
--

CREATE TABLE public.pg_proc (
    created_at timestamp with time zone DEFAULT now(),
    id uuid DEFAULT public.gen_random_uuid() NOT NULL,
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.pg_proc OWNER TO cresceja;

--
-- Name: pg_trigger; Type: TABLE; Schema: public; Owner: cresceja
--

CREATE TABLE public.pg_trigger (
    created_at timestamp with time zone DEFAULT now(),
    id uuid DEFAULT public.gen_random_uuid() NOT NULL,
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.pg_trigger OWNER TO cresceja;

--
-- Name: pg_type; Type: TABLE; Schema: public; Owner: cresceja
--

CREATE TABLE public.pg_type (
    created_at timestamp with time zone DEFAULT now(),
    id uuid DEFAULT public.gen_random_uuid() NOT NULL,
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.pg_type OWNER TO cresceja;

--
-- Name: plan_credits; Type: TABLE; Schema: public; Owner: cresceja
--

CREATE TABLE public.plan_credits (
    ai_attendance_monthly text,
    ai_content_monthly text,
    created_at timestamp with time zone DEFAULT now(),
    id uuid DEFAULT public.gen_random_uuid() NOT NULL,
    plan_id uuid DEFAULT public.gen_random_uuid(),
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.plan_credits OWNER TO cresceja;

--
-- Name: plan_features; Type: TABLE; Schema: public; Owner: cresceja
--

CREATE TABLE public.plan_features (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    feature_code text,
    plan_id uuid
);


ALTER TABLE public.plan_features OWNER TO cresceja;

--
-- Name: plans; Type: TABLE; Schema: public; Owner: cresceja
--

CREATE TABLE public.plans (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text,
    code text,
    ai_tokens_limit bigint DEFAULT 0 NOT NULL,
    is_free boolean DEFAULT false,
    trial_days integer DEFAULT 14,
    billing_period_months integer DEFAULT 1,
    price_cents integer DEFAULT 0,
    currency text DEFAULT 'BRL'::text,
    CONSTRAINT chk_plans_price_nonneg CHECK ((price_cents >= 0))
);


ALTER TABLE public.plans OWNER TO cresceja;

--
-- Name: plans_meta; Type: TABLE; Schema: public; Owner: cresceja
--

CREATE TABLE public.plans_meta (
    created_at timestamp with time zone DEFAULT now(),
    id uuid DEFAULT public.gen_random_uuid() NOT NULL,
    max_users text,
    plan_id uuid DEFAULT public.gen_random_uuid(),
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.plans_meta OWNER TO cresceja;

--
-- Name: post_approvals; Type: TABLE; Schema: public; Owner: cresceja
--

CREATE TABLE public.post_approvals (
    approver_id uuid DEFAULT public.gen_random_uuid(),
    created_at timestamp with time zone DEFAULT now(),
    id uuid DEFAULT public.gen_random_uuid() NOT NULL,
    notes text,
    post_id uuid DEFAULT public.gen_random_uuid(),
    status text,
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.post_approvals OWNER TO cresceja;

--
-- Name: posts; Type: TABLE; Schema: public; Owner: cresceja
--

CREATE TABLE public.posts (
    id uuid DEFAULT gen_random_uuid() NOT NULL
);


ALTER TABLE public.posts OWNER TO cresceja;

--
-- Name: public; Type: TABLE; Schema: public; Owner: cresceja
--

CREATE TABLE public.public (
    created_at timestamp with time zone DEFAULT now(),
    id uuid DEFAULT public.gen_random_uuid() NOT NULL,
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.public OWNER TO cresceja;

--
-- Name: purchases; Type: TABLE; Schema: public; Owner: cresceja
--

CREATE TABLE public.purchases (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    org_id uuid,
    created_at timestamp with time zone
);


ALTER TABLE public.purchases OWNER TO cresceja;

--
-- Name: quick_replies; Type: TABLE; Schema: public; Owner: cresceja
--

CREATE TABLE public.quick_replies (
    "[title" text,
    body text,
    company_id uuid DEFAULT public.gen_random_uuid(),
    created_at timestamp with time zone DEFAULT now(),
    id uuid DEFAULT public.gen_random_uuid() NOT NULL,
    "id]
    )" text,
    title text,
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.quick_replies OWNER TO cresceja;

--
-- Name: reminder_logs; Type: TABLE; Schema: public; Owner: cresceja
--

CREATE TABLE public.reminder_logs (
    channel text,
    created_at timestamp with time zone DEFAULT now(),
    event_id uuid DEFAULT public.gen_random_uuid(),
    hash text,
    id uuid DEFAULT public.gen_random_uuid() NOT NULL,
    recipient text,
    sent_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.reminder_logs OWNER TO cresceja;

--
-- Name: repurpose_jobs; Type: TABLE; Schema: public; Owner: cresceja
--

CREATE TABLE public.repurpose_jobs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    post_id uuid
);


ALTER TABLE public.repurpose_jobs OWNER TO cresceja;

--
-- Name: rewards; Type: TABLE; Schema: public; Owner: cresceja
--

CREATE TABLE public.rewards (
    id uuid DEFAULT gen_random_uuid() NOT NULL
);


ALTER TABLE public.rewards OWNER TO cresceja;

--
-- Name: segments; Type: TABLE; Schema: public; Owner: cresceja
--

CREATE TABLE public.segments (
    id uuid DEFAULT public.gen_random_uuid() NOT NULL,
    company_id uuid,
    name text NOT NULL,
    filter jsonb NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.segments OWNER TO cresceja;

--
-- Name: social_posts; Type: TABLE; Schema: public; Owner: cresceja
--

CREATE TABLE public.social_posts (
    id uuid DEFAULT gen_random_uuid() NOT NULL
);


ALTER TABLE public.social_posts OWNER TO cresceja;

--
-- Name: subscriptions; Type: TABLE; Schema: public; Owner: cresceja
--

CREATE TABLE public.subscriptions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    org_id uuid
);


ALTER TABLE public.subscriptions OWNER TO cresceja;

--
-- Name: support_audit_logs; Type: TABLE; Schema: public; Owner: cresceja
--

CREATE TABLE public.support_audit_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL
);


ALTER TABLE public.support_audit_logs OWNER TO cresceja;

--
-- Name: support_tickets; Type: TABLE; Schema: public; Owner: cresceja
--

CREATE TABLE public.support_tickets (
    created_at timestamp with time zone DEFAULT now(),
    description text,
    id uuid DEFAULT public.gen_random_uuid() NOT NULL,
    org_id uuid DEFAULT public.gen_random_uuid(),
    status text,
    subject text,
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.support_tickets OWNER TO cresceja;

--
-- Name: tags; Type: TABLE; Schema: public; Owner: cresceja
--

CREATE TABLE public.tags (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text,
    org_id uuid
);


ALTER TABLE public.tags OWNER TO cresceja;

--
-- Name: telemetry_events; Type: TABLE; Schema: public; Owner: cresceja
--

CREATE TABLE public.telemetry_events (
    created_at timestamp with time zone DEFAULT now(),
    event_key text,
    id uuid DEFAULT public.gen_random_uuid() NOT NULL,
    metadata text,
    occurred_at timestamp with time zone DEFAULT now(),
    org_id uuid DEFAULT public.gen_random_uuid(),
    source text,
    updated_at timestamp with time zone DEFAULT now(),
    user_id uuid DEFAULT public.gen_random_uuid(),
    value_num numeric
);


ALTER TABLE public.telemetry_events OWNER TO cresceja;

--
-- Name: telemetry_kpis_daily; Type: TABLE; Schema: public; Owner: cresceja
--

CREATE TABLE public.telemetry_kpis_daily (
    "PRIMARY" text,
    created_at timestamp with time zone DEFAULT now(),
    day text,
    id uuid DEFAULT public.gen_random_uuid() NOT NULL,
    metric text,
    org_id uuid DEFAULT public.gen_random_uuid(),
    updated_at timestamp with time zone DEFAULT now(),
    value text
);


ALTER TABLE public.telemetry_kpis_daily OWNER TO cresceja;

--
-- Name: usage_counters; Type: TABLE; Schema: public; Owner: cresceja
--

CREATE TABLE public.usage_counters (
    client_id uuid,
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    module_key text,
    period_end timestamp with time zone,
    period_start timestamp with time zone
);


ALTER TABLE public.usage_counters OWNER TO cresceja;

--
-- Name: usage_reports; Type: TABLE; Schema: public; Owner: cresceja
--

CREATE TABLE public.usage_reports (
    created_at timestamp with time zone DEFAULT now(),
    id uuid DEFAULT public.gen_random_uuid() NOT NULL,
    metrics text,
    org_id uuid DEFAULT public.gen_random_uuid(),
    period_end text,
    period_start text,
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.usage_reports OWNER TO cresceja;

--
-- Name: user_orgs; Type: TABLE; Schema: public; Owner: cresceja
--

CREATE TABLE public.user_orgs (
    "PRIMARY" text,
    created_at timestamp with time zone DEFAULT now(),
    id uuid DEFAULT public.gen_random_uuid() NOT NULL,
    org_id uuid DEFAULT public.gen_random_uuid(),
    role text,
    updated_at timestamp with time zone DEFAULT now(),
    user_id uuid DEFAULT public.gen_random_uuid()
);


ALTER TABLE public.user_orgs OWNER TO cresceja;

--
-- Name: users; Type: TABLE; Schema: public; Owner: cresceja
--

CREATE TABLE public.users (
    email text NOT NULL,
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    password_hash text,
    name text,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    last_login_at timestamp with time zone,
    org_id uuid,
    roles text[] DEFAULT ARRAY[]::text[] NOT NULL,
    is_superadmin boolean DEFAULT false NOT NULL
);


ALTER TABLE public.users OWNER TO cresceja;

--
-- Name: whatsapp_channels; Type: TABLE; Schema: public; Owner: cresceja
--

CREATE TABLE public.whatsapp_channels (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    org_id uuid,
    phone_e164 text
);


ALTER TABLE public.whatsapp_channels OWNER TO cresceja;

--
-- Name: ai_credit_usage ai_credit_usage_pkey; Type: CONSTRAINT; Schema: public; Owner: cresceja
--

ALTER TABLE ONLY public.ai_credit_usage
    ADD CONSTRAINT ai_credit_usage_pkey PRIMARY KEY (id);


--
-- Name: ai_guardrail_violations ai_guardrail_violations_pkey; Type: CONSTRAINT; Schema: public; Owner: cresceja
--

ALTER TABLE ONLY public.ai_guardrail_violations
    ADD CONSTRAINT ai_guardrail_violations_pkey PRIMARY KEY (id);


--
-- Name: ai_meters ai_meters_pkey; Type: CONSTRAINT; Schema: public; Owner: cresceja
--

ALTER TABLE ONLY public.ai_meters
    ADD CONSTRAINT ai_meters_pkey PRIMARY KEY (id);


--
-- Name: ai_usage_logs ai_usage_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: cresceja
--

ALTER TABLE ONLY public.ai_usage_logs
    ADD CONSTRAINT ai_usage_logs_pkey PRIMARY KEY (id);


--
-- Name: ai_usage ai_usage_pkey; Type: CONSTRAINT; Schema: public; Owner: cresceja
--

ALTER TABLE ONLY public.ai_usage
    ADD CONSTRAINT ai_usage_pkey PRIMARY KEY (id);


--
-- Name: assets assets_pkey; Type: CONSTRAINT; Schema: public; Owner: cresceja
--

ALTER TABLE ONLY public.assets
    ADD CONSTRAINT assets_pkey PRIMARY KEY (id);


--
-- Name: audit_logs audit_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: cresceja
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_pkey PRIMARY KEY (id);


--
-- Name: calendar_events calendar_events_pkey; Type: CONSTRAINT; Schema: public; Owner: cresceja
--

ALTER TABLE ONLY public.calendar_events
    ADD CONSTRAINT calendar_events_pkey PRIMARY KEY (id);


--
-- Name: calendar_members calendar_members_pkey; Type: CONSTRAINT; Schema: public; Owner: cresceja
--

ALTER TABLE ONLY public.calendar_members
    ADD CONSTRAINT calendar_members_pkey PRIMARY KEY (id);


--
-- Name: calendars calendars_pkey; Type: CONSTRAINT; Schema: public; Owner: cresceja
--

ALTER TABLE ONLY public.calendars
    ADD CONSTRAINT calendars_pkey PRIMARY KEY (id);


--
-- Name: channel_accounts channel_accounts_pkey; Type: CONSTRAINT; Schema: public; Owner: cresceja
--

ALTER TABLE ONLY public.channel_accounts
    ADD CONSTRAINT channel_accounts_pkey PRIMARY KEY (id);


--
-- Name: channel_id_map channel_id_map_pkey; Type: CONSTRAINT; Schema: public; Owner: cresceja
--

ALTER TABLE ONLY public.channel_id_map
    ADD CONSTRAINT channel_id_map_pkey PRIMARY KEY (id);


--
-- Name: channels channels_pkey; Type: CONSTRAINT; Schema: public; Owner: cresceja
--

ALTER TABLE ONLY public.channels
    ADD CONSTRAINT channels_pkey PRIMARY KEY (id);


--
-- Name: clients clients_pkey; Type: CONSTRAINT; Schema: public; Owner: cresceja
--

ALTER TABLE ONLY public.clients
    ADD CONSTRAINT clients_pkey PRIMARY KEY (id);


--
-- Name: contact_identities contact_identities_pkey; Type: CONSTRAINT; Schema: public; Owner: cresceja
--

ALTER TABLE ONLY public.contact_identities
    ADD CONSTRAINT contact_identities_pkey PRIMARY KEY (id);


--
-- Name: contact_tags contact_tags_pkey; Type: CONSTRAINT; Schema: public; Owner: cresceja
--

ALTER TABLE ONLY public.contact_tags
    ADD CONSTRAINT contact_tags_pkey PRIMARY KEY (id);


--
-- Name: contacts contacts_pkey; Type: CONSTRAINT; Schema: public; Owner: cresceja
--

ALTER TABLE ONLY public.contacts
    ADD CONSTRAINT contacts_pkey PRIMARY KEY (id);


--
-- Name: content_assets content_assets_pkey; Type: CONSTRAINT; Schema: public; Owner: cresceja
--

ALTER TABLE ONLY public.content_assets
    ADD CONSTRAINT content_assets_pkey PRIMARY KEY (id);


--
-- Name: content_campaigns content_campaigns_pkey; Type: CONSTRAINT; Schema: public; Owner: cresceja
--

ALTER TABLE ONLY public.content_campaigns
    ADD CONSTRAINT content_campaigns_pkey PRIMARY KEY (id);


--
-- Name: content_suggestions content_suggestions_pkey; Type: CONSTRAINT; Schema: public; Owner: cresceja
--

ALTER TABLE ONLY public.content_suggestions
    ADD CONSTRAINT content_suggestions_pkey PRIMARY KEY (id);


--
-- Name: conversations conversations_pkey; Type: CONSTRAINT; Schema: public; Owner: cresceja
--

ALTER TABLE ONLY public.conversations
    ADD CONSTRAINT conversations_pkey PRIMARY KEY (id);


--
-- Name: crm_opportunities crm_opportunities_pkey; Type: CONSTRAINT; Schema: public; Owner: cresceja
--

ALTER TABLE ONLY public.crm_opportunities
    ADD CONSTRAINT crm_opportunities_pkey PRIMARY KEY (id);


--
-- Name: email_automation_steps email_automation_steps_pkey; Type: CONSTRAINT; Schema: public; Owner: cresceja
--

ALTER TABLE ONLY public.email_automation_steps
    ADD CONSTRAINT email_automation_steps_pkey PRIMARY KEY (id);


--
-- Name: email_automations email_automations_pkey; Type: CONSTRAINT; Schema: public; Owner: cresceja
--

ALTER TABLE ONLY public.email_automations
    ADD CONSTRAINT email_automations_pkey PRIMARY KEY (id);


--
-- Name: email_campaign_recipients email_campaign_recipients_pkey; Type: CONSTRAINT; Schema: public; Owner: cresceja
--

ALTER TABLE ONLY public.email_campaign_recipients
    ADD CONSTRAINT email_campaign_recipients_pkey PRIMARY KEY (id);


--
-- Name: email_campaigns email_campaigns_pkey; Type: CONSTRAINT; Schema: public; Owner: cresceja
--

ALTER TABLE ONLY public.email_campaigns
    ADD CONSTRAINT email_campaigns_pkey PRIMARY KEY (id);


--
-- Name: email_events email_events_pkey; Type: CONSTRAINT; Schema: public; Owner: cresceja
--

ALTER TABLE ONLY public.email_events
    ADD CONSTRAINT email_events_pkey PRIMARY KEY (id);


--
-- Name: email_lists email_lists_pkey; Type: CONSTRAINT; Schema: public; Owner: cresceja
--

ALTER TABLE ONLY public.email_lists
    ADD CONSTRAINT email_lists_pkey PRIMARY KEY (id);


--
-- Name: email_subscriptions email_subscriptions_pkey; Type: CONSTRAINT; Schema: public; Owner: cresceja
--

ALTER TABLE ONLY public.email_subscriptions
    ADD CONSTRAINT email_subscriptions_pkey PRIMARY KEY (id);


--
-- Name: email_suppressions email_suppressions_pkey; Type: CONSTRAINT; Schema: public; Owner: cresceja
--

ALTER TABLE ONLY public.email_suppressions
    ADD CONSTRAINT email_suppressions_pkey PRIMARY KEY (id);


--
-- Name: email_templates email_templates_pkey; Type: CONSTRAINT; Schema: public; Owner: cresceja
--

ALTER TABLE ONLY public.email_templates
    ADD CONSTRAINT email_templates_pkey PRIMARY KEY (id);


--
-- Name: facebook_oauth_tokens facebook_oauth_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: cresceja
--

ALTER TABLE ONLY public.facebook_oauth_tokens
    ADD CONSTRAINT facebook_oauth_tokens_pkey PRIMARY KEY (id);


--
-- Name: facebook_pages facebook_pages_pkey; Type: CONSTRAINT; Schema: public; Owner: cresceja
--

ALTER TABLE ONLY public.facebook_pages
    ADD CONSTRAINT facebook_pages_pkey PRIMARY KEY (id);


--
-- Name: facebook_publish_jobs facebook_publish_jobs_pkey; Type: CONSTRAINT; Schema: public; Owner: cresceja
--

ALTER TABLE ONLY public.facebook_publish_jobs
    ADD CONSTRAINT facebook_publish_jobs_pkey PRIMARY KEY (id);


--
-- Name: feature_defs feature_defs_pkey; Type: CONSTRAINT; Schema: public; Owner: cresceja
--

ALTER TABLE ONLY public.feature_defs
    ADD CONSTRAINT feature_defs_pkey PRIMARY KEY (id);


--
-- Name: google_calendar_accounts google_calendar_accounts_pkey; Type: CONSTRAINT; Schema: public; Owner: cresceja
--

ALTER TABLE ONLY public.google_calendar_accounts
    ADD CONSTRAINT google_calendar_accounts_pkey PRIMARY KEY (id);


--
-- Name: google_oauth_tokens google_oauth_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: cresceja
--

ALTER TABLE ONLY public.google_oauth_tokens
    ADD CONSTRAINT google_oauth_tokens_pkey PRIMARY KEY (id);


--
-- Name: inbox_ai_flags inbox_ai_flags_pkey; Type: CONSTRAINT; Schema: public; Owner: cresceja
--

ALTER TABLE ONLY public.inbox_ai_flags
    ADD CONSTRAINT inbox_ai_flags_pkey PRIMARY KEY (id);


--
-- Name: inbox_audit_events inbox_audit_events_pkey; Type: CONSTRAINT; Schema: public; Owner: cresceja
--

ALTER TABLE ONLY public.inbox_audit_events
    ADD CONSTRAINT inbox_audit_events_pkey PRIMARY KEY (id);


--
-- Name: inbox_idempotency inbox_idempotency_pkey; Type: CONSTRAINT; Schema: public; Owner: cresceja
--

ALTER TABLE ONLY public.inbox_idempotency
    ADD CONSTRAINT inbox_idempotency_pkey PRIMARY KEY (id);


--
-- Name: information_schema information_schema_pkey; Type: CONSTRAINT; Schema: public; Owner: cresceja
--

ALTER TABLE ONLY public.information_schema
    ADD CONSTRAINT information_schema_pkey PRIMARY KEY (id);


--
-- Name: instagram_accounts instagram_accounts_pkey; Type: CONSTRAINT; Schema: public; Owner: cresceja
--

ALTER TABLE ONLY public.instagram_accounts
    ADD CONSTRAINT instagram_accounts_pkey PRIMARY KEY (id);


--
-- Name: instagram_oauth_tokens instagram_oauth_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: cresceja
--

ALTER TABLE ONLY public.instagram_oauth_tokens
    ADD CONSTRAINT instagram_oauth_tokens_pkey PRIMARY KEY (id);


--
-- Name: instagram_publish_jobs instagram_publish_jobs_pkey; Type: CONSTRAINT; Schema: public; Owner: cresceja
--

ALTER TABLE ONLY public.instagram_publish_jobs
    ADD CONSTRAINT instagram_publish_jobs_pkey PRIMARY KEY (id);


--
-- Name: integration_events integration_events_pkey; Type: CONSTRAINT; Schema: public; Owner: cresceja
--

ALTER TABLE ONLY public.integration_events
    ADD CONSTRAINT integration_events_pkey PRIMARY KEY (id);


--
-- Name: invoices invoices_pkey; Type: CONSTRAINT; Schema: public; Owner: cresceja
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_pkey PRIMARY KEY (id);


--
-- Name: kb_documents kb_documents_pkey; Type: CONSTRAINT; Schema: public; Owner: cresceja
--

ALTER TABLE ONLY public.kb_documents
    ADD CONSTRAINT kb_documents_pkey PRIMARY KEY (id);


--
-- Name: leads leads_pkey; Type: CONSTRAINT; Schema: public; Owner: cresceja
--

ALTER TABLE ONLY public.leads
    ADD CONSTRAINT leads_pkey PRIMARY KEY (id);


--
-- Name: lgpd_consents lgpd_consents_pkey; Type: CONSTRAINT; Schema: public; Owner: cresceja
--

ALTER TABLE ONLY public.lgpd_consents
    ADD CONSTRAINT lgpd_consents_pkey PRIMARY KEY (id);


--
-- Name: lgpd_erasure_requests lgpd_erasure_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: cresceja
--

ALTER TABLE ONLY public.lgpd_erasure_requests
    ADD CONSTRAINT lgpd_erasure_requests_pkey PRIMARY KEY (id);


--
-- Name: message_attachments message_attachments_pkey; Type: CONSTRAINT; Schema: public; Owner: cresceja
--

ALTER TABLE ONLY public.message_attachments
    ADD CONSTRAINT message_attachments_pkey PRIMARY KEY (id);


--
-- Name: message_status_events message_status_events_pkey; Type: CONSTRAINT; Schema: public; Owner: cresceja
--

ALTER TABLE ONLY public.message_status_events
    ADD CONSTRAINT message_status_events_pkey PRIMARY KEY (id);


--
-- Name: message_templates message_templates_pkey; Type: CONSTRAINT; Schema: public; Owner: cresceja
--

ALTER TABLE ONLY public.message_templates
    ADD CONSTRAINT message_templates_pkey PRIMARY KEY (id);


--
-- Name: message_transcripts message_transcripts_pkey; Type: CONSTRAINT; Schema: public; Owner: cresceja
--

ALTER TABLE ONLY public.message_transcripts
    ADD CONSTRAINT message_transcripts_pkey PRIMARY KEY (id);


--
-- Name: messages messages_pkey; Type: CONSTRAINT; Schema: public; Owner: cresceja
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_pkey PRIMARY KEY (id);


--
-- Name: meta_tokens meta_tokens_org_id_key; Type: CONSTRAINT; Schema: public; Owner: cresceja
--

ALTER TABLE ONLY public.meta_tokens
    ADD CONSTRAINT meta_tokens_org_id_key UNIQUE (org_id);


--
-- Name: meta_tokens meta_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: cresceja
--

ALTER TABLE ONLY public.meta_tokens
    ADD CONSTRAINT meta_tokens_pkey PRIMARY KEY (id);


--
-- Name: nps_responses nps_responses_pkey; Type: CONSTRAINT; Schema: public; Owner: cresceja
--

ALTER TABLE ONLY public.nps_responses
    ADD CONSTRAINT nps_responses_pkey PRIMARY KEY (id);


--
-- Name: nps_surveys nps_surveys_pkey; Type: CONSTRAINT; Schema: public; Owner: cresceja
--

ALTER TABLE ONLY public.nps_surveys
    ADD CONSTRAINT nps_surveys_pkey PRIMARY KEY (id);


--
-- Name: onboarding_tasks onboarding_tasks_pkey; Type: CONSTRAINT; Schema: public; Owner: cresceja
--

ALTER TABLE ONLY public.onboarding_tasks
    ADD CONSTRAINT onboarding_tasks_pkey PRIMARY KEY (id);


--
-- Name: opportunities opportunities_pkey; Type: CONSTRAINT; Schema: public; Owner: cresceja
--

ALTER TABLE ONLY public.opportunities
    ADD CONSTRAINT opportunities_pkey PRIMARY KEY (id);


--
-- Name: org_ai_profiles org_ai_profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: cresceja
--

ALTER TABLE ONLY public.org_ai_profiles
    ADD CONSTRAINT org_ai_profiles_pkey PRIMARY KEY (id);


--
-- Name: org_ai_settings org_ai_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: cresceja
--

ALTER TABLE ONLY public.org_ai_settings
    ADD CONSTRAINT org_ai_settings_pkey PRIMARY KEY (id);


--
-- Name: org_credits org_credits_pkey; Type: CONSTRAINT; Schema: public; Owner: cresceja
--

ALTER TABLE ONLY public.org_credits
    ADD CONSTRAINT org_credits_pkey PRIMARY KEY (id);


--
-- Name: org_features org_features_pkey; Type: CONSTRAINT; Schema: public; Owner: cresceja
--

ALTER TABLE ONLY public.org_features
    ADD CONSTRAINT org_features_pkey PRIMARY KEY (id);


--
-- Name: org_integration_logs org_integration_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: cresceja
--

ALTER TABLE ONLY public.org_integration_logs
    ADD CONSTRAINT org_integration_logs_pkey PRIMARY KEY (id);


--
-- Name: org_integrations org_integrations_pkey; Type: CONSTRAINT; Schema: public; Owner: cresceja
--

ALTER TABLE ONLY public.org_integrations
    ADD CONSTRAINT org_integrations_pkey PRIMARY KEY (id);


--
-- Name: org_plan_history org_plan_history_pkey; Type: CONSTRAINT; Schema: public; Owner: cresceja
--

ALTER TABLE ONLY public.org_plan_history
    ADD CONSTRAINT org_plan_history_pkey PRIMARY KEY (id);


--
-- Name: org_settings org_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: cresceja
--

ALTER TABLE ONLY public.org_settings
    ADD CONSTRAINT org_settings_pkey PRIMARY KEY (id);


--
-- Name: org_subscriptions org_subscriptions_pkey; Type: CONSTRAINT; Schema: public; Owner: cresceja
--

ALTER TABLE ONLY public.org_subscriptions
    ADD CONSTRAINT org_subscriptions_pkey PRIMARY KEY (id);


--
-- Name: org_users org_users_pkey; Type: CONSTRAINT; Schema: public; Owner: cresceja
--

ALTER TABLE ONLY public.org_users
    ADD CONSTRAINT org_users_pkey PRIMARY KEY (id);


--
-- Name: organizations organizations_pkey; Type: CONSTRAINT; Schema: public; Owner: cresceja
--

ALTER TABLE ONLY public.organizations
    ADD CONSTRAINT organizations_pkey PRIMARY KEY (id);


--
-- Name: organizations organizations_slug_key; Type: CONSTRAINT; Schema: public; Owner: cresceja
--

ALTER TABLE ONLY public.organizations
    ADD CONSTRAINT organizations_slug_key UNIQUE (slug);


--
-- Name: payments payments_pkey; Type: CONSTRAINT; Schema: public; Owner: cresceja
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_pkey PRIMARY KEY (id);


--
-- Name: pg_attribute pg_attribute_pkey; Type: CONSTRAINT; Schema: public; Owner: cresceja
--

ALTER TABLE ONLY public.pg_attribute
    ADD CONSTRAINT pg_attribute_pkey PRIMARY KEY (id);


--
-- Name: pg_class pg_class_pkey; Type: CONSTRAINT; Schema: public; Owner: cresceja
--

ALTER TABLE ONLY public.pg_class
    ADD CONSTRAINT pg_class_pkey PRIMARY KEY (id);


--
-- Name: pg_constraint pg_constraint_pkey; Type: CONSTRAINT; Schema: public; Owner: cresceja
--

ALTER TABLE ONLY public.pg_constraint
    ADD CONSTRAINT pg_constraint_pkey PRIMARY KEY (id);


--
-- Name: pg_indexes pg_indexes_pkey; Type: CONSTRAINT; Schema: public; Owner: cresceja
--

ALTER TABLE ONLY public.pg_indexes
    ADD CONSTRAINT pg_indexes_pkey PRIMARY KEY (id);


--
-- Name: pg_proc pg_proc_pkey; Type: CONSTRAINT; Schema: public; Owner: cresceja
--

ALTER TABLE ONLY public.pg_proc
    ADD CONSTRAINT pg_proc_pkey PRIMARY KEY (id);


--
-- Name: pg_trigger pg_trigger_pkey; Type: CONSTRAINT; Schema: public; Owner: cresceja
--

ALTER TABLE ONLY public.pg_trigger
    ADD CONSTRAINT pg_trigger_pkey PRIMARY KEY (id);


--
-- Name: pg_type pg_type_pkey; Type: CONSTRAINT; Schema: public; Owner: cresceja
--

ALTER TABLE ONLY public.pg_type
    ADD CONSTRAINT pg_type_pkey PRIMARY KEY (id);


--
-- Name: plan_credits plan_credits_pkey; Type: CONSTRAINT; Schema: public; Owner: cresceja
--

ALTER TABLE ONLY public.plan_credits
    ADD CONSTRAINT plan_credits_pkey PRIMARY KEY (id);


--
-- Name: plan_features plan_features_pkey; Type: CONSTRAINT; Schema: public; Owner: cresceja
--

ALTER TABLE ONLY public.plan_features
    ADD CONSTRAINT plan_features_pkey PRIMARY KEY (id);


--
-- Name: plans plans_code_key; Type: CONSTRAINT; Schema: public; Owner: cresceja
--

ALTER TABLE ONLY public.plans
    ADD CONSTRAINT plans_code_key UNIQUE (code);


--
-- Name: plans_meta plans_meta_pkey; Type: CONSTRAINT; Schema: public; Owner: cresceja
--

ALTER TABLE ONLY public.plans_meta
    ADD CONSTRAINT plans_meta_pkey PRIMARY KEY (id);


--
-- Name: plans plans_pkey; Type: CONSTRAINT; Schema: public; Owner: cresceja
--

ALTER TABLE ONLY public.plans
    ADD CONSTRAINT plans_pkey PRIMARY KEY (id);


--
-- Name: post_approvals post_approvals_pkey; Type: CONSTRAINT; Schema: public; Owner: cresceja
--

ALTER TABLE ONLY public.post_approvals
    ADD CONSTRAINT post_approvals_pkey PRIMARY KEY (id);


--
-- Name: posts posts_pkey; Type: CONSTRAINT; Schema: public; Owner: cresceja
--

ALTER TABLE ONLY public.posts
    ADD CONSTRAINT posts_pkey PRIMARY KEY (id);


--
-- Name: public public_pkey; Type: CONSTRAINT; Schema: public; Owner: cresceja
--

ALTER TABLE ONLY public.public
    ADD CONSTRAINT public_pkey PRIMARY KEY (id);


--
-- Name: purchases purchases_pkey; Type: CONSTRAINT; Schema: public; Owner: cresceja
--

ALTER TABLE ONLY public.purchases
    ADD CONSTRAINT purchases_pkey PRIMARY KEY (id);


--
-- Name: quick_replies quick_replies_pkey; Type: CONSTRAINT; Schema: public; Owner: cresceja
--

ALTER TABLE ONLY public.quick_replies
    ADD CONSTRAINT quick_replies_pkey PRIMARY KEY (id);


--
-- Name: reminder_logs reminder_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: cresceja
--

ALTER TABLE ONLY public.reminder_logs
    ADD CONSTRAINT reminder_logs_pkey PRIMARY KEY (id);


--
-- Name: repurpose_jobs repurpose_jobs_pkey; Type: CONSTRAINT; Schema: public; Owner: cresceja
--

ALTER TABLE ONLY public.repurpose_jobs
    ADD CONSTRAINT repurpose_jobs_pkey PRIMARY KEY (id);


--
-- Name: rewards rewards_pkey; Type: CONSTRAINT; Schema: public; Owner: cresceja
--

ALTER TABLE ONLY public.rewards
    ADD CONSTRAINT rewards_pkey PRIMARY KEY (id);


--
-- Name: segments segments_pkey; Type: CONSTRAINT; Schema: public; Owner: cresceja
--

ALTER TABLE ONLY public.segments
    ADD CONSTRAINT segments_pkey PRIMARY KEY (id);


--
-- Name: social_posts social_posts_pkey; Type: CONSTRAINT; Schema: public; Owner: cresceja
--

ALTER TABLE ONLY public.social_posts
    ADD CONSTRAINT social_posts_pkey PRIMARY KEY (id);


--
-- Name: subscriptions subscriptions_pkey; Type: CONSTRAINT; Schema: public; Owner: cresceja
--

ALTER TABLE ONLY public.subscriptions
    ADD CONSTRAINT subscriptions_pkey PRIMARY KEY (id);


--
-- Name: support_audit_logs support_audit_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: cresceja
--

ALTER TABLE ONLY public.support_audit_logs
    ADD CONSTRAINT support_audit_logs_pkey PRIMARY KEY (id);


--
-- Name: support_tickets support_tickets_pkey; Type: CONSTRAINT; Schema: public; Owner: cresceja
--

ALTER TABLE ONLY public.support_tickets
    ADD CONSTRAINT support_tickets_pkey PRIMARY KEY (id);


--
-- Name: tags tags_pkey; Type: CONSTRAINT; Schema: public; Owner: cresceja
--

ALTER TABLE ONLY public.tags
    ADD CONSTRAINT tags_pkey PRIMARY KEY (id);


--
-- Name: telemetry_events telemetry_events_pkey; Type: CONSTRAINT; Schema: public; Owner: cresceja
--

ALTER TABLE ONLY public.telemetry_events
    ADD CONSTRAINT telemetry_events_pkey PRIMARY KEY (id);


--
-- Name: telemetry_kpis_daily telemetry_kpis_daily_pkey; Type: CONSTRAINT; Schema: public; Owner: cresceja
--

ALTER TABLE ONLY public.telemetry_kpis_daily
    ADD CONSTRAINT telemetry_kpis_daily_pkey PRIMARY KEY (id);


--
-- Name: usage_counters usage_counters_pkey; Type: CONSTRAINT; Schema: public; Owner: cresceja
--

ALTER TABLE ONLY public.usage_counters
    ADD CONSTRAINT usage_counters_pkey PRIMARY KEY (id);


--
-- Name: usage_reports usage_reports_pkey; Type: CONSTRAINT; Schema: public; Owner: cresceja
--

ALTER TABLE ONLY public.usage_reports
    ADD CONSTRAINT usage_reports_pkey PRIMARY KEY (id);


--
-- Name: user_orgs user_orgs_pkey; Type: CONSTRAINT; Schema: public; Owner: cresceja
--

ALTER TABLE ONLY public.user_orgs
    ADD CONSTRAINT user_orgs_pkey PRIMARY KEY (id);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: cresceja
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: plans ux_plans_code; Type: CONSTRAINT; Schema: public; Owner: cresceja
--

ALTER TABLE ONLY public.plans
    ADD CONSTRAINT ux_plans_code UNIQUE (code);


--
-- Name: whatsapp_channels whatsapp_channels_pkey; Type: CONSTRAINT; Schema: public; Owner: cresceja
--

ALTER TABLE ONLY public.whatsapp_channels
    ADD CONSTRAINT whatsapp_channels_pkey PRIMARY KEY (id);


--
-- Name: channel_accounts_org_id_channel_external_account_id_key; Type: INDEX; Schema: public; Owner: cresceja
--

CREATE UNIQUE INDEX channel_accounts_org_id_channel_external_account_id_key ON public.channel_accounts USING btree (org_id, channel, external_account_id);


--
-- Name: contact_identities_org_id_channel_account_id_identity_key; Type: INDEX; Schema: public; Owner: cresceja
--

CREATE UNIQUE INDEX contact_identities_org_id_channel_account_id_identity_key ON public.contact_identities USING btree (org_id, channel, account_id, identity);


--
-- Name: conv_chat_transport_idx; Type: INDEX; Schema: public; Owner: cresceja
--

CREATE UNIQUE INDEX conv_chat_transport_idx ON public.conversations USING btree (chat_id, transport);


--
-- Name: email_subscriptions_org_id_list_id_email_key; Type: INDEX; Schema: public; Owner: cresceja
--

CREATE UNIQUE INDEX email_subscriptions_org_id_list_id_email_key ON public.email_subscriptions USING btree (org_id, list_id, email);


--
-- Name: facebook_oauth_tokens_page_id_key; Type: INDEX; Schema: public; Owner: cresceja
--

CREATE UNIQUE INDEX facebook_oauth_tokens_page_id_key ON public.facebook_oauth_tokens USING btree (page_id);


--
-- Name: facebook_pages_org_id_page_id_key; Type: INDEX; Schema: public; Owner: cresceja
--

CREATE UNIQUE INDEX facebook_pages_org_id_page_id_key ON public.facebook_pages USING btree (org_id, page_id);


--
-- Name: feature_defs_code_key; Type: INDEX; Schema: public; Owner: cresceja
--

CREATE UNIQUE INDEX feature_defs_code_key ON public.feature_defs USING btree (code);


--
-- Name: google_calendar_accounts_org_id_google_user_id_key; Type: INDEX; Schema: public; Owner: cresceja
--

CREATE UNIQUE INDEX google_calendar_accounts_org_id_google_user_id_key ON public.google_calendar_accounts USING btree (org_id, google_user_id);


--
-- Name: idx_ai_credit_usage_user_id; Type: INDEX; Schema: public; Owner: cresceja
--

CREATE INDEX idx_ai_credit_usage_user_id ON public.ai_credit_usage USING btree (user_id);


--
-- Name: idx_ai_guardrail_violations_org_id; Type: INDEX; Schema: public; Owner: cresceja
--

CREATE INDEX idx_ai_guardrail_violations_org_id ON public.ai_guardrail_violations USING btree (org_id);


--
-- Name: idx_ai_guardrail_violations_user_id; Type: INDEX; Schema: public; Owner: cresceja
--

CREATE INDEX idx_ai_guardrail_violations_user_id ON public.ai_guardrail_violations USING btree (user_id);


--
-- Name: idx_ai_usage_org_id; Type: INDEX; Schema: public; Owner: cresceja
--

CREATE INDEX idx_ai_usage_org_id ON public.ai_usage USING btree (org_id);


--
-- Name: idx_ai_usage_org_meter; Type: INDEX; Schema: public; Owner: cresceja
--

CREATE INDEX idx_ai_usage_org_meter ON public.ai_usage USING btree (org_id, meter_code, created_at);


--
-- Name: idx_channel_accounts_org_id; Type: INDEX; Schema: public; Owner: cresceja
--

CREATE INDEX idx_channel_accounts_org_id ON public.channel_accounts USING btree (org_id);


--
-- Name: idx_channels_config_gin; Type: INDEX; Schema: public; Owner: cresceja
--

CREATE INDEX idx_channels_config_gin ON public.channels USING gin (config);


--
-- Name: idx_channels_org_id; Type: INDEX; Schema: public; Owner: cresceja
--

CREATE INDEX idx_channels_org_id ON public.channels USING btree (org_id);


--
-- Name: idx_channels_org_type_mode; Type: INDEX; Schema: public; Owner: cresceja
--

CREATE UNIQUE INDEX idx_channels_org_type_mode ON public.channels USING btree (org_id, type, mode);


--
-- Name: idx_channels_secrets_gin; Type: INDEX; Schema: public; Owner: cresceja
--

CREATE INDEX idx_channels_secrets_gin ON public.channels USING gin (secrets);


--
-- Name: idx_clients_org_id; Type: INDEX; Schema: public; Owner: cresceja
--

CREATE INDEX idx_clients_org_id ON public.clients USING btree (org_id);


--
-- Name: idx_contact_identities_account_id; Type: INDEX; Schema: public; Owner: cresceja
--

CREATE INDEX idx_contact_identities_account_id ON public.contact_identities USING btree (account_id);


--
-- Name: idx_contact_identities_org_id; Type: INDEX; Schema: public; Owner: cresceja
--

CREATE INDEX idx_contact_identities_org_id ON public.contact_identities USING btree (org_id);


--
-- Name: idx_contact_tags_contact_id; Type: INDEX; Schema: public; Owner: cresceja
--

CREATE INDEX idx_contact_tags_contact_id ON public.contact_tags USING btree (contact_id);


--
-- Name: idx_contact_tags_tag_id; Type: INDEX; Schema: public; Owner: cresceja
--

CREATE INDEX idx_contact_tags_tag_id ON public.contact_tags USING btree (tag_id);


--
-- Name: idx_contacts_org; Type: INDEX; Schema: public; Owner: cresceja
--

CREATE INDEX idx_contacts_org ON public.contacts USING btree (org_id);


--
-- Name: idx_contacts_org_id; Type: INDEX; Schema: public; Owner: cresceja
--

CREATE INDEX idx_contacts_org_id ON public.contacts USING btree (org_id);


--
-- Name: idx_conversations_org_id; Type: INDEX; Schema: public; Owner: cresceja
--

CREATE INDEX idx_conversations_org_id ON public.conversations USING btree (org_id);


--
-- Name: idx_conversations_org_last; Type: INDEX; Schema: public; Owner: cresceja
--

CREATE INDEX idx_conversations_org_last ON public.conversations USING btree (org_id, last_message_at DESC);


--
-- Name: idx_email_subscriptions_list_id; Type: INDEX; Schema: public; Owner: cresceja
--

CREATE INDEX idx_email_subscriptions_list_id ON public.email_subscriptions USING btree (list_id);


--
-- Name: idx_email_subscriptions_org_id; Type: INDEX; Schema: public; Owner: cresceja
--

CREATE INDEX idx_email_subscriptions_org_id ON public.email_subscriptions USING btree (org_id);


--
-- Name: idx_email_suppressions_org_id; Type: INDEX; Schema: public; Owner: cresceja
--

CREATE INDEX idx_email_suppressions_org_id ON public.email_suppressions USING btree (org_id);


--
-- Name: idx_facebook_oauth_tokens_page_id; Type: INDEX; Schema: public; Owner: cresceja
--

CREATE INDEX idx_facebook_oauth_tokens_page_id ON public.facebook_oauth_tokens USING btree (page_id);


--
-- Name: idx_facebook_pages_org_id; Type: INDEX; Schema: public; Owner: cresceja
--

CREATE INDEX idx_facebook_pages_org_id ON public.facebook_pages USING btree (org_id);


--
-- Name: idx_facebook_publish_jobs_org_id; Type: INDEX; Schema: public; Owner: cresceja
--

CREATE INDEX idx_facebook_publish_jobs_org_id ON public.facebook_publish_jobs USING btree (org_id);


--
-- Name: idx_facebook_publish_jobs_page_id; Type: INDEX; Schema: public; Owner: cresceja
--

CREATE INDEX idx_facebook_publish_jobs_page_id ON public.facebook_publish_jobs USING btree (page_id);


--
-- Name: idx_fb_jobs_org_sched; Type: INDEX; Schema: public; Owner: cresceja
--

CREATE INDEX idx_fb_jobs_org_sched ON public.facebook_publish_jobs USING btree (org_id, scheduled_at);


--
-- Name: idx_fb_jobs_status; Type: INDEX; Schema: public; Owner: cresceja
--

CREATE INDEX idx_fb_jobs_status ON public.facebook_publish_jobs USING btree (status);


--
-- Name: idx_google_calendar_accounts_org_id; Type: INDEX; Schema: public; Owner: cresceja
--

CREATE INDEX idx_google_calendar_accounts_org_id ON public.google_calendar_accounts USING btree (org_id);


--
-- Name: idx_inbox_ai_flags_conversation_id; Type: INDEX; Schema: public; Owner: cresceja
--

CREATE INDEX idx_inbox_ai_flags_conversation_id ON public.inbox_ai_flags USING btree (conversation_id);


--
-- Name: idx_inbox_ai_flags_org_id; Type: INDEX; Schema: public; Owner: cresceja
--

CREATE INDEX idx_inbox_ai_flags_org_id ON public.inbox_ai_flags USING btree (org_id);


--
-- Name: idx_inbox_audit_events_actor_id; Type: INDEX; Schema: public; Owner: cresceja
--

CREATE INDEX idx_inbox_audit_events_actor_id ON public.inbox_audit_events USING btree (actor_id);


--
-- Name: idx_inbox_audit_events_org_id; Type: INDEX; Schema: public; Owner: cresceja
--

CREATE INDEX idx_inbox_audit_events_org_id ON public.inbox_audit_events USING btree (org_id);


--
-- Name: idx_instagram_accounts_org_id; Type: INDEX; Schema: public; Owner: cresceja
--

CREATE INDEX idx_instagram_accounts_org_id ON public.instagram_accounts USING btree (org_id);


--
-- Name: idx_instagram_jobs_org; Type: INDEX; Schema: public; Owner: cresceja
--

CREATE INDEX idx_instagram_jobs_org ON public.instagram_publish_jobs USING btree (org_id);


--
-- Name: idx_instagram_jobs_status; Type: INDEX; Schema: public; Owner: cresceja
--

CREATE INDEX idx_instagram_jobs_status ON public.instagram_publish_jobs USING btree (status);


--
-- Name: idx_instagram_oauth_tokens_account_id; Type: INDEX; Schema: public; Owner: cresceja
--

CREATE INDEX idx_instagram_oauth_tokens_account_id ON public.instagram_oauth_tokens USING btree (account_id);


--
-- Name: idx_instagram_publish_jobs_account_id; Type: INDEX; Schema: public; Owner: cresceja
--

CREATE INDEX idx_instagram_publish_jobs_account_id ON public.instagram_publish_jobs USING btree (account_id);


--
-- Name: idx_instagram_publish_jobs_org_id; Type: INDEX; Schema: public; Owner: cresceja
--

CREATE INDEX idx_instagram_publish_jobs_org_id ON public.instagram_publish_jobs USING btree (org_id);


--
-- Name: idx_integration_events_org_id; Type: INDEX; Schema: public; Owner: cresceja
--

CREATE INDEX idx_integration_events_org_id ON public.integration_events USING btree (org_id);


--
-- Name: idx_invoices_org; Type: INDEX; Schema: public; Owner: cresceja
--

CREATE INDEX idx_invoices_org ON public.invoices USING btree (org_id, created_at DESC);


--
-- Name: idx_kb_documents_org_id; Type: INDEX; Schema: public; Owner: cresceja
--

CREATE INDEX idx_kb_documents_org_id ON public.kb_documents USING btree (org_id);


--
-- Name: idx_leads_org_id; Type: INDEX; Schema: public; Owner: cresceja
--

CREATE INDEX idx_leads_org_id ON public.leads USING btree (org_id);


--
-- Name: idx_message_attachments_message_id; Type: INDEX; Schema: public; Owner: cresceja
--

CREATE INDEX idx_message_attachments_message_id ON public.message_attachments USING btree (message_id);


--
-- Name: idx_messages_conv_created; Type: INDEX; Schema: public; Owner: cresceja
--

CREATE INDEX idx_messages_conv_created ON public.messages USING btree (conversation_id, created_at DESC);


--
-- Name: idx_messages_conversation_id; Type: INDEX; Schema: public; Owner: cresceja
--

CREATE INDEX idx_messages_conversation_id ON public.messages USING btree (conversation_id);


--
-- Name: idx_messages_meta_gin; Type: INDEX; Schema: public; Owner: cresceja
--

CREATE INDEX idx_messages_meta_gin ON public.messages USING gin (meta);


--
-- Name: idx_messages_org; Type: INDEX; Schema: public; Owner: cresceja
--

CREATE INDEX idx_messages_org ON public.messages USING btree (org_id);


--
-- Name: idx_messages_org_id; Type: INDEX; Schema: public; Owner: cresceja
--

CREATE INDEX idx_messages_org_id ON public.messages USING btree (org_id);


--
-- Name: idx_meta_tokens_org_id; Type: INDEX; Schema: public; Owner: cresceja
--

CREATE INDEX idx_meta_tokens_org_id ON public.meta_tokens USING btree (org_id);


--
-- Name: idx_opportunities_lead_id; Type: INDEX; Schema: public; Owner: cresceja
--

CREATE INDEX idx_opportunities_lead_id ON public.opportunities USING btree (lead_id);


--
-- Name: idx_opportunities_org_id; Type: INDEX; Schema: public; Owner: cresceja
--

CREATE INDEX idx_opportunities_org_id ON public.opportunities USING btree (org_id);


--
-- Name: idx_org_ai_profiles_org_id; Type: INDEX; Schema: public; Owner: cresceja
--

CREATE INDEX idx_org_ai_profiles_org_id ON public.org_ai_profiles USING btree (org_id);


--
-- Name: idx_org_ai_profiles_updated_by; Type: INDEX; Schema: public; Owner: cresceja
--

CREATE INDEX idx_org_ai_profiles_updated_by ON public.org_ai_profiles USING btree (updated_by);


--
-- Name: idx_org_ai_settings_org_id; Type: INDEX; Schema: public; Owner: cresceja
--

CREATE INDEX idx_org_ai_settings_org_id ON public.org_ai_settings USING btree (org_id);


--
-- Name: idx_org_features_gin; Type: INDEX; Schema: public; Owner: cresceja
--

CREATE INDEX idx_org_features_gin ON public.org_features USING gin (features);


--
-- Name: idx_org_features_org_id; Type: INDEX; Schema: public; Owner: cresceja
--

CREATE INDEX idx_org_features_org_id ON public.org_features USING btree (org_id);


--
-- Name: idx_org_integration_logs_org_id; Type: INDEX; Schema: public; Owner: cresceja
--

CREATE INDEX idx_org_integration_logs_org_id ON public.org_integration_logs USING btree (org_id);


--
-- Name: idx_org_integrations_org_id; Type: INDEX; Schema: public; Owner: cresceja
--

CREATE INDEX idx_org_integrations_org_id ON public.org_integrations USING btree (org_id);


--
-- Name: idx_org_plan_history_org_id; Type: INDEX; Schema: public; Owner: cresceja
--

CREATE INDEX idx_org_plan_history_org_id ON public.org_plan_history USING btree (org_id);


--
-- Name: idx_org_plan_history_plan_id; Type: INDEX; Schema: public; Owner: cresceja
--

CREATE INDEX idx_org_plan_history_plan_id ON public.org_plan_history USING btree (plan_id);


--
-- Name: idx_org_settings_org_id; Type: INDEX; Schema: public; Owner: cresceja
--

CREATE INDEX idx_org_settings_org_id ON public.org_settings USING btree (org_id);


--
-- Name: idx_org_subscriptions_org_id; Type: INDEX; Schema: public; Owner: cresceja
--

CREATE INDEX idx_org_subscriptions_org_id ON public.org_subscriptions USING btree (org_id);


--
-- Name: idx_org_subscriptions_plan_id; Type: INDEX; Schema: public; Owner: cresceja
--

CREATE INDEX idx_org_subscriptions_plan_id ON public.org_subscriptions USING btree (plan_id);


--
-- Name: idx_org_users_org_id; Type: INDEX; Schema: public; Owner: cresceja
--

CREATE INDEX idx_org_users_org_id ON public.org_users USING btree (org_id);


--
-- Name: idx_org_users_user_id; Type: INDEX; Schema: public; Owner: cresceja
--

CREATE INDEX idx_org_users_user_id ON public.org_users USING btree (user_id);


--
-- Name: idx_organizations_status_created; Type: INDEX; Schema: public; Owner: cresceja
--

CREATE INDEX idx_organizations_status_created ON public.organizations USING btree (status, created_at DESC);


--
-- Name: idx_payments_org_created; Type: INDEX; Schema: public; Owner: cresceja
--

CREATE INDEX idx_payments_org_created ON public.payments USING btree (org_id, created_at DESC);


--
-- Name: idx_plan_credits_plan_id; Type: INDEX; Schema: public; Owner: cresceja
--

CREATE INDEX idx_plan_credits_plan_id ON public.plan_credits USING btree (plan_id);


--
-- Name: idx_plan_features_plan_id; Type: INDEX; Schema: public; Owner: cresceja
--

CREATE INDEX idx_plan_features_plan_id ON public.plan_features USING btree (plan_id);


--
-- Name: idx_plans_meta_plan_id; Type: INDEX; Schema: public; Owner: cresceja
--

CREATE INDEX idx_plans_meta_plan_id ON public.plans_meta USING btree (plan_id);


--
-- Name: idx_post_approvals_approver_id; Type: INDEX; Schema: public; Owner: cresceja
--

CREATE INDEX idx_post_approvals_approver_id ON public.post_approvals USING btree (approver_id);


--
-- Name: idx_post_approvals_post_id; Type: INDEX; Schema: public; Owner: cresceja
--

CREATE INDEX idx_post_approvals_post_id ON public.post_approvals USING btree (post_id);


--
-- Name: idx_purchases_org_created; Type: INDEX; Schema: public; Owner: cresceja
--

CREATE INDEX idx_purchases_org_created ON public.purchases USING btree (org_id, created_at DESC);


--
-- Name: idx_quick_replies_company_id; Type: INDEX; Schema: public; Owner: cresceja
--

CREATE INDEX idx_quick_replies_company_id ON public.quick_replies USING btree (company_id);


--
-- Name: idx_repurpose_jobs_post_id; Type: INDEX; Schema: public; Owner: cresceja
--

CREATE INDEX idx_repurpose_jobs_post_id ON public.repurpose_jobs USING btree (post_id);


--
-- Name: idx_subscriptions_org_id; Type: INDEX; Schema: public; Owner: cresceja
--

CREATE INDEX idx_subscriptions_org_id ON public.subscriptions USING btree (org_id);


--
-- Name: idx_support_tickets_org_id; Type: INDEX; Schema: public; Owner: cresceja
--

CREATE INDEX idx_support_tickets_org_id ON public.support_tickets USING btree (org_id);


--
-- Name: idx_tags_org_id; Type: INDEX; Schema: public; Owner: cresceja
--

CREATE INDEX idx_tags_org_id ON public.tags USING btree (org_id);


--
-- Name: idx_te_org_time; Type: INDEX; Schema: public; Owner: cresceja
--

CREATE INDEX idx_te_org_time ON public.telemetry_events USING btree (org_id, occurred_at DESC);


--
-- Name: idx_telemetry_events_org_id; Type: INDEX; Schema: public; Owner: cresceja
--

CREATE INDEX idx_telemetry_events_org_id ON public.telemetry_events USING btree (org_id);


--
-- Name: idx_telemetry_events_user_id; Type: INDEX; Schema: public; Owner: cresceja
--

CREATE INDEX idx_telemetry_events_user_id ON public.telemetry_events USING btree (user_id);


--
-- Name: idx_telemetry_kpis_daily_org_id; Type: INDEX; Schema: public; Owner: cresceja
--

CREATE INDEX idx_telemetry_kpis_daily_org_id ON public.telemetry_kpis_daily USING btree (org_id);


--
-- Name: idx_usage_counters_client_id; Type: INDEX; Schema: public; Owner: cresceja
--

CREATE INDEX idx_usage_counters_client_id ON public.usage_counters USING btree (client_id);


--
-- Name: idx_usage_reports_org_id; Type: INDEX; Schema: public; Owner: cresceja
--

CREATE INDEX idx_usage_reports_org_id ON public.usage_reports USING btree (org_id);


--
-- Name: idx_user_orgs_org_id; Type: INDEX; Schema: public; Owner: cresceja
--

CREATE INDEX idx_user_orgs_org_id ON public.user_orgs USING btree (org_id);


--
-- Name: idx_user_orgs_user_id; Type: INDEX; Schema: public; Owner: cresceja
--

CREATE INDEX idx_user_orgs_user_id ON public.user_orgs USING btree (user_id);


--
-- Name: idx_users_email; Type: INDEX; Schema: public; Owner: cresceja
--

CREATE UNIQUE INDEX idx_users_email ON public.users USING btree (email);


--
-- Name: idx_users_org_id; Type: INDEX; Schema: public; Owner: cresceja
--

CREATE INDEX idx_users_org_id ON public.users USING btree (org_id);


--
-- Name: idx_whatsapp_channels_org_id; Type: INDEX; Schema: public; Owner: cresceja
--

CREATE INDEX idx_whatsapp_channels_org_id ON public.whatsapp_channels USING btree (org_id);


--
-- Name: instagram_accounts_org_id_ig_user_id_key; Type: INDEX; Schema: public; Owner: cresceja
--

CREATE UNIQUE INDEX instagram_accounts_org_id_ig_user_id_key ON public.instagram_accounts USING btree (org_id, ig_user_id);


--
-- Name: instagram_oauth_tokens_account_id_key; Type: INDEX; Schema: public; Owner: cresceja
--

CREATE UNIQUE INDEX instagram_oauth_tokens_account_id_key ON public.instagram_oauth_tokens USING btree (account_id);


--
-- Name: ix_meta_tokens_org; Type: INDEX; Schema: public; Owner: cresceja
--

CREATE INDEX ix_meta_tokens_org ON public.meta_tokens USING btree (org_id);


--
-- Name: organizations_status_created_idx; Type: INDEX; Schema: public; Owner: cresceja
--

CREATE INDEX organizations_status_created_idx ON public.organizations USING btree (status, created_at DESC);


--
-- Name: subscriptions_org_id_key; Type: INDEX; Schema: public; Owner: cresceja
--

CREATE UNIQUE INDEX subscriptions_org_id_key ON public.subscriptions USING btree (org_id);


--
-- Name: uq_conversations_uniqueness; Type: INDEX; Schema: public; Owner: cresceja
--

CREATE UNIQUE INDEX uq_conversations_uniqueness ON public.conversations USING btree (org_id, channel, account_id, external_user_id);


--
-- Name: uq_ma_message_idx; Type: INDEX; Schema: public; Owner: cresceja
--

CREATE UNIQUE INDEX uq_ma_message_idx ON public.message_attachments USING btree (message_id, idx);


--
-- Name: uq_org_ai_settings_org; Type: INDEX; Schema: public; Owner: cresceja
--

CREATE UNIQUE INDEX uq_org_ai_settings_org ON public.org_ai_settings USING btree (org_id);


--
-- Name: usage_counters_client_id_module_key_period_start_period_end_key; Type: INDEX; Schema: public; Owner: cresceja
--

CREATE UNIQUE INDEX usage_counters_client_id_module_key_period_start_period_end_key ON public.usage_counters USING btree (client_id, module_key, period_start, period_end);


--
-- Name: users_email_key; Type: INDEX; Schema: public; Owner: cresceja
--

CREATE UNIQUE INDEX users_email_key ON public.users USING btree (email);


--
-- Name: ux_contacts_email_per_org; Type: INDEX; Schema: public; Owner: cresceja
--

CREATE UNIQUE INDEX ux_contacts_email_per_org ON public.contacts USING btree (org_id, lower(email)) WHERE (email IS NOT NULL);


--
-- Name: ux_contacts_phone_per_org; Type: INDEX; Schema: public; Owner: cresceja
--

CREATE UNIQUE INDEX ux_contacts_phone_per_org ON public.contacts USING btree (org_id, phone_e164) WHERE (phone_e164 IS NOT NULL);


--
-- Name: ux_conversations_external; Type: INDEX; Schema: public; Owner: cresceja
--

CREATE UNIQUE INDEX ux_conversations_external ON public.conversations USING btree (org_id, channel, account_id, external_user_id);


--
-- Name: ux_messages_external_per_org; Type: INDEX; Schema: public; Owner: cresceja
--

CREATE UNIQUE INDEX ux_messages_external_per_org ON public.messages USING btree (org_id, external_message_id) WHERE (external_message_id IS NOT NULL);


--
-- Name: ux_msg_attachments_idx; Type: INDEX; Schema: public; Owner: cresceja
--

CREATE UNIQUE INDEX ux_msg_attachments_idx ON public.message_attachments USING btree (message_id, idx);


--
-- Name: ux_org_document_digits; Type: INDEX; Schema: public; Owner: cresceja
--

CREATE UNIQUE INDEX ux_org_document_digits ON public.organizations USING btree (regexp_replace(COALESCE(document_value, ''::text), '\D'::text, ''::text, 'g'::text)) WHERE (document_value IS NOT NULL);


--
-- Name: ux_org_email_lower; Type: INDEX; Schema: public; Owner: cresceja
--

CREATE UNIQUE INDEX ux_org_email_lower ON public.organizations USING btree (lower(email)) WHERE (email IS NOT NULL);


--
-- Name: ux_org_phone_e164; Type: INDEX; Schema: public; Owner: cresceja
--

CREATE UNIQUE INDEX ux_org_phone_e164 ON public.organizations USING btree (phone_e164) WHERE (phone_e164 IS NOT NULL);


--
-- Name: ux_org_slug; Type: INDEX; Schema: public; Owner: cresceja
--

CREATE UNIQUE INDEX ux_org_slug ON public.organizations USING btree (slug);


--
-- Name: ux_org_users_pk; Type: INDEX; Schema: public; Owner: cresceja
--

CREATE UNIQUE INDEX ux_org_users_pk ON public.org_users USING btree (org_id, user_id);


--
-- Name: ux_orgs_email_lower; Type: INDEX; Schema: public; Owner: cresceja
--

CREATE UNIQUE INDEX ux_orgs_email_lower ON public.organizations USING btree (public.util_email_lower(email)) WHERE (email IS NOT NULL);


--
-- Name: ux_plan_features; Type: INDEX; Schema: public; Owner: cresceja
--

CREATE UNIQUE INDEX ux_plan_features ON public.plan_features USING btree (plan_id, feature_code);


--
-- Name: ux_plan_features_plan_code; Type: INDEX; Schema: public; Owner: cresceja
--

CREATE UNIQUE INDEX ux_plan_features_plan_code ON public.plan_features USING btree (plan_id, feature_code);


--
-- Name: ux_tags_org_lower_name; Type: INDEX; Schema: public; Owner: cresceja
--

CREATE UNIQUE INDEX ux_tags_org_lower_name ON public.tags USING btree (org_id, lower(name));


--
-- Name: ux_users_email; Type: INDEX; Schema: public; Owner: cresceja
--

CREATE UNIQUE INDEX ux_users_email ON public.users USING btree (lower(email));


--
-- Name: whatsapp_channels_org_id_id_key; Type: INDEX; Schema: public; Owner: cresceja
--

CREATE UNIQUE INDEX whatsapp_channels_org_id_id_key ON public.whatsapp_channels USING btree (org_id, id);


--
-- Name: whatsapp_channels_org_id_phone_e164_key; Type: INDEX; Schema: public; Owner: cresceja
--

CREATE UNIQUE INDEX whatsapp_channels_org_id_phone_e164_key ON public.whatsapp_channels USING btree (org_id, phone_e164);


--
-- Name: ai_guardrail_violations ai_guardrail_violations_set_updated_at; Type: TRIGGER; Schema: public; Owner: cresceja
--

CREATE TRIGGER ai_guardrail_violations_set_updated_at BEFORE UPDATE ON public.ai_guardrail_violations FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: ai_meters ai_meters_set_updated_at; Type: TRIGGER; Schema: public; Owner: cresceja
--

CREATE TRIGGER ai_meters_set_updated_at BEFORE UPDATE ON public.ai_meters FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: ai_usage ai_usage_set_updated_at; Type: TRIGGER; Schema: public; Owner: cresceja
--

CREATE TRIGGER ai_usage_set_updated_at BEFORE UPDATE ON public.ai_usage FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: email_suppressions email_suppressions_set_updated_at; Type: TRIGGER; Schema: public; Owner: cresceja
--

CREATE TRIGGER email_suppressions_set_updated_at BEFORE UPDATE ON public.email_suppressions FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: inbox_ai_flags inbox_ai_flags_set_updated_at; Type: TRIGGER; Schema: public; Owner: cresceja
--

CREATE TRIGGER inbox_ai_flags_set_updated_at BEFORE UPDATE ON public.inbox_ai_flags FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: inbox_audit_events inbox_audit_events_set_updated_at; Type: TRIGGER; Schema: public; Owner: cresceja
--

CREATE TRIGGER inbox_audit_events_set_updated_at BEFORE UPDATE ON public.inbox_audit_events FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: inbox_idempotency inbox_idempotency_set_updated_at; Type: TRIGGER; Schema: public; Owner: cresceja
--

CREATE TRIGGER inbox_idempotency_set_updated_at BEFORE UPDATE ON public.inbox_idempotency FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: information_schema information_schema_set_updated_at; Type: TRIGGER; Schema: public; Owner: cresceja
--

CREATE TRIGGER information_schema_set_updated_at BEFORE UPDATE ON public.information_schema FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: integration_events integration_events_set_updated_at; Type: TRIGGER; Schema: public; Owner: cresceja
--

CREATE TRIGGER integration_events_set_updated_at BEFORE UPDATE ON public.integration_events FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: kb_documents kb_documents_set_updated_at; Type: TRIGGER; Schema: public; Owner: cresceja
--

CREATE TRIGGER kb_documents_set_updated_at BEFORE UPDATE ON public.kb_documents FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: messages messages_after_insert_bump_last; Type: TRIGGER; Schema: public; Owner: cresceja
--

CREATE TRIGGER messages_after_insert_bump_last AFTER INSERT ON public.messages FOR EACH ROW EXECUTE FUNCTION public.bump_conversation_last_message_at();


--
-- Name: messages messages_set_updated_at; Type: TRIGGER; Schema: public; Owner: cresceja
--

CREATE TRIGGER messages_set_updated_at BEFORE UPDATE ON public.messages FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: opportunities opportunities_set_updated_at; Type: TRIGGER; Schema: public; Owner: cresceja
--

CREATE TRIGGER opportunities_set_updated_at BEFORE UPDATE ON public.opportunities FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: org_ai_profiles org_ai_profiles_set_updated_at; Type: TRIGGER; Schema: public; Owner: cresceja
--

CREATE TRIGGER org_ai_profiles_set_updated_at BEFORE UPDATE ON public.org_ai_profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: org_credits org_credits_set_updated_at; Type: TRIGGER; Schema: public; Owner: cresceja
--

CREATE TRIGGER org_credits_set_updated_at BEFORE UPDATE ON public.org_credits FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: org_features org_features_set_updated_at; Type: TRIGGER; Schema: public; Owner: cresceja
--

CREATE TRIGGER org_features_set_updated_at BEFORE UPDATE ON public.org_features FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: org_integration_logs org_integration_logs_set_updated_at; Type: TRIGGER; Schema: public; Owner: cresceja
--

CREATE TRIGGER org_integration_logs_set_updated_at BEFORE UPDATE ON public.org_integration_logs FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: org_integrations org_integrations_set_updated_at; Type: TRIGGER; Schema: public; Owner: cresceja
--

CREATE TRIGGER org_integrations_set_updated_at BEFORE UPDATE ON public.org_integrations FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: org_plan_history org_plan_history_set_updated_at; Type: TRIGGER; Schema: public; Owner: cresceja
--

CREATE TRIGGER org_plan_history_set_updated_at BEFORE UPDATE ON public.org_plan_history FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: org_settings org_settings_set_updated_at; Type: TRIGGER; Schema: public; Owner: cresceja
--

CREATE TRIGGER org_settings_set_updated_at BEFORE UPDATE ON public.org_settings FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: org_subscriptions org_subscriptions_set_updated_at; Type: TRIGGER; Schema: public; Owner: cresceja
--

CREATE TRIGGER org_subscriptions_set_updated_at BEFORE UPDATE ON public.org_subscriptions FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: organizations organizations_set_updated_at; Type: TRIGGER; Schema: public; Owner: cresceja
--

CREATE TRIGGER organizations_set_updated_at BEFORE UPDATE ON public.organizations FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: pg_attribute pg_attribute_set_updated_at; Type: TRIGGER; Schema: public; Owner: cresceja
--

CREATE TRIGGER pg_attribute_set_updated_at BEFORE UPDATE ON public.pg_attribute FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: pg_class pg_class_set_updated_at; Type: TRIGGER; Schema: public; Owner: cresceja
--

CREATE TRIGGER pg_class_set_updated_at BEFORE UPDATE ON public.pg_class FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: pg_constraint pg_constraint_set_updated_at; Type: TRIGGER; Schema: public; Owner: cresceja
--

CREATE TRIGGER pg_constraint_set_updated_at BEFORE UPDATE ON public.pg_constraint FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: pg_indexes pg_indexes_set_updated_at; Type: TRIGGER; Schema: public; Owner: cresceja
--

CREATE TRIGGER pg_indexes_set_updated_at BEFORE UPDATE ON public.pg_indexes FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: pg_proc pg_proc_set_updated_at; Type: TRIGGER; Schema: public; Owner: cresceja
--

CREATE TRIGGER pg_proc_set_updated_at BEFORE UPDATE ON public.pg_proc FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: pg_trigger pg_trigger_set_updated_at; Type: TRIGGER; Schema: public; Owner: cresceja
--

CREATE TRIGGER pg_trigger_set_updated_at BEFORE UPDATE ON public.pg_trigger FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: pg_type pg_type_set_updated_at; Type: TRIGGER; Schema: public; Owner: cresceja
--

CREATE TRIGGER pg_type_set_updated_at BEFORE UPDATE ON public.pg_type FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: plan_credits plan_credits_set_updated_at; Type: TRIGGER; Schema: public; Owner: cresceja
--

CREATE TRIGGER plan_credits_set_updated_at BEFORE UPDATE ON public.plan_credits FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: plans_meta plans_meta_set_updated_at; Type: TRIGGER; Schema: public; Owner: cresceja
--

CREATE TRIGGER plans_meta_set_updated_at BEFORE UPDATE ON public.plans_meta FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: post_approvals post_approvals_set_updated_at; Type: TRIGGER; Schema: public; Owner: cresceja
--

CREATE TRIGGER post_approvals_set_updated_at BEFORE UPDATE ON public.post_approvals FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: public public_set_updated_at; Type: TRIGGER; Schema: public; Owner: cresceja
--

CREATE TRIGGER public_set_updated_at BEFORE UPDATE ON public.public FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: quick_replies quick_replies_set_updated_at; Type: TRIGGER; Schema: public; Owner: cresceja
--

CREATE TRIGGER quick_replies_set_updated_at BEFORE UPDATE ON public.quick_replies FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: reminder_logs reminder_logs_set_updated_at; Type: TRIGGER; Schema: public; Owner: cresceja
--

CREATE TRIGGER reminder_logs_set_updated_at BEFORE UPDATE ON public.reminder_logs FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: support_tickets support_tickets_set_updated_at; Type: TRIGGER; Schema: public; Owner: cresceja
--

CREATE TRIGGER support_tickets_set_updated_at BEFORE UPDATE ON public.support_tickets FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: telemetry_events telemetry_events_set_updated_at; Type: TRIGGER; Schema: public; Owner: cresceja
--

CREATE TRIGGER telemetry_events_set_updated_at BEFORE UPDATE ON public.telemetry_events FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: telemetry_kpis_daily telemetry_kpis_daily_set_updated_at; Type: TRIGGER; Schema: public; Owner: cresceja
--

CREATE TRIGGER telemetry_kpis_daily_set_updated_at BEFORE UPDATE ON public.telemetry_kpis_daily FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: usage_reports usage_reports_set_updated_at; Type: TRIGGER; Schema: public; Owner: cresceja
--

CREATE TRIGGER usage_reports_set_updated_at BEFORE UPDATE ON public.usage_reports FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: user_orgs user_orgs_set_updated_at; Type: TRIGGER; Schema: public; Owner: cresceja
--

CREATE TRIGGER user_orgs_set_updated_at BEFORE UPDATE ON public.user_orgs FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: users users_set_updated_at; Type: TRIGGER; Schema: public; Owner: cresceja
--

CREATE TRIGGER users_set_updated_at BEFORE UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: ai_credit_usage fk_ai_credit_usage_user_id__users_id; Type: FK CONSTRAINT; Schema: public; Owner: cresceja
--

ALTER TABLE ONLY public.ai_credit_usage
    ADD CONSTRAINT fk_ai_credit_usage_user_id__users_id FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: ai_guardrail_violations fk_ai_guardrail_violations_org_id__organizations_id; Type: FK CONSTRAINT; Schema: public; Owner: cresceja
--

ALTER TABLE ONLY public.ai_guardrail_violations
    ADD CONSTRAINT fk_ai_guardrail_violations_org_id__organizations_id FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: ai_guardrail_violations fk_ai_guardrail_violations_user_id__users_id; Type: FK CONSTRAINT; Schema: public; Owner: cresceja
--

ALTER TABLE ONLY public.ai_guardrail_violations
    ADD CONSTRAINT fk_ai_guardrail_violations_user_id__users_id FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: ai_usage fk_ai_usage_org_id__organizations_id; Type: FK CONSTRAINT; Schema: public; Owner: cresceja
--

ALTER TABLE ONLY public.ai_usage
    ADD CONSTRAINT fk_ai_usage_org_id__organizations_id FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: channel_accounts fk_channel_accounts_org_id__organizations_id; Type: FK CONSTRAINT; Schema: public; Owner: cresceja
--

ALTER TABLE ONLY public.channel_accounts
    ADD CONSTRAINT fk_channel_accounts_org_id__organizations_id FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: channels fk_channels_org_id__organizations_id; Type: FK CONSTRAINT; Schema: public; Owner: cresceja
--

ALTER TABLE ONLY public.channels
    ADD CONSTRAINT fk_channels_org_id__organizations_id FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: clients fk_clients_org_id__organizations_id; Type: FK CONSTRAINT; Schema: public; Owner: cresceja
--

ALTER TABLE ONLY public.clients
    ADD CONSTRAINT fk_clients_org_id__organizations_id FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: contact_identities fk_contact_identities_account_id__channel_accounts_id; Type: FK CONSTRAINT; Schema: public; Owner: cresceja
--

ALTER TABLE ONLY public.contact_identities
    ADD CONSTRAINT fk_contact_identities_account_id__channel_accounts_id FOREIGN KEY (account_id) REFERENCES public.channel_accounts(id) ON DELETE SET NULL;


--
-- Name: contact_identities fk_contact_identities_org_id__organizations_id; Type: FK CONSTRAINT; Schema: public; Owner: cresceja
--

ALTER TABLE ONLY public.contact_identities
    ADD CONSTRAINT fk_contact_identities_org_id__organizations_id FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: contact_tags fk_contact_tags_contact_id__contacts_id; Type: FK CONSTRAINT; Schema: public; Owner: cresceja
--

ALTER TABLE ONLY public.contact_tags
    ADD CONSTRAINT fk_contact_tags_contact_id__contacts_id FOREIGN KEY (contact_id) REFERENCES public.contacts(id) ON DELETE CASCADE;


--
-- Name: contact_tags fk_contact_tags_tag_id__tags_id; Type: FK CONSTRAINT; Schema: public; Owner: cresceja
--

ALTER TABLE ONLY public.contact_tags
    ADD CONSTRAINT fk_contact_tags_tag_id__tags_id FOREIGN KEY (tag_id) REFERENCES public.tags(id) ON DELETE CASCADE;


--
-- Name: contacts fk_contacts_org_id__organizations_id; Type: FK CONSTRAINT; Schema: public; Owner: cresceja
--

ALTER TABLE ONLY public.contacts
    ADD CONSTRAINT fk_contacts_org_id__organizations_id FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: conversations fk_conversations_org_id__organizations_id; Type: FK CONSTRAINT; Schema: public; Owner: cresceja
--

ALTER TABLE ONLY public.conversations
    ADD CONSTRAINT fk_conversations_org_id__organizations_id FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: email_subscriptions fk_email_subscriptions_list_id__email_lists_id; Type: FK CONSTRAINT; Schema: public; Owner: cresceja
--

ALTER TABLE ONLY public.email_subscriptions
    ADD CONSTRAINT fk_email_subscriptions_list_id__email_lists_id FOREIGN KEY (list_id) REFERENCES public.email_lists(id) ON DELETE CASCADE;


--
-- Name: email_subscriptions fk_email_subscriptions_org_id__organizations_id; Type: FK CONSTRAINT; Schema: public; Owner: cresceja
--

ALTER TABLE ONLY public.email_subscriptions
    ADD CONSTRAINT fk_email_subscriptions_org_id__organizations_id FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: email_suppressions fk_email_suppressions_org_id__organizations_id; Type: FK CONSTRAINT; Schema: public; Owner: cresceja
--

ALTER TABLE ONLY public.email_suppressions
    ADD CONSTRAINT fk_email_suppressions_org_id__organizations_id FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: facebook_oauth_tokens fk_facebook_oauth_tokens_page_id__facebook_pages_id; Type: FK CONSTRAINT; Schema: public; Owner: cresceja
--

ALTER TABLE ONLY public.facebook_oauth_tokens
    ADD CONSTRAINT fk_facebook_oauth_tokens_page_id__facebook_pages_id FOREIGN KEY (page_id) REFERENCES public.facebook_pages(id) ON DELETE CASCADE;


--
-- Name: facebook_pages fk_facebook_pages_org_id__organizations_id; Type: FK CONSTRAINT; Schema: public; Owner: cresceja
--

ALTER TABLE ONLY public.facebook_pages
    ADD CONSTRAINT fk_facebook_pages_org_id__organizations_id FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: facebook_publish_jobs fk_facebook_publish_jobs_org_id__organizations_id; Type: FK CONSTRAINT; Schema: public; Owner: cresceja
--

ALTER TABLE ONLY public.facebook_publish_jobs
    ADD CONSTRAINT fk_facebook_publish_jobs_org_id__organizations_id FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: facebook_publish_jobs fk_facebook_publish_jobs_page_id__facebook_pages_id; Type: FK CONSTRAINT; Schema: public; Owner: cresceja
--

ALTER TABLE ONLY public.facebook_publish_jobs
    ADD CONSTRAINT fk_facebook_publish_jobs_page_id__facebook_pages_id FOREIGN KEY (page_id) REFERENCES public.facebook_pages(id) ON DELETE CASCADE;


--
-- Name: facebook_publish_jobs fk_fb_jobs_org_id__organizations_id; Type: FK CONSTRAINT; Schema: public; Owner: cresceja
--

ALTER TABLE ONLY public.facebook_publish_jobs
    ADD CONSTRAINT fk_fb_jobs_org_id__organizations_id FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: google_calendar_accounts fk_google_calendar_accounts_org_id__organizations_id; Type: FK CONSTRAINT; Schema: public; Owner: cresceja
--

ALTER TABLE ONLY public.google_calendar_accounts
    ADD CONSTRAINT fk_google_calendar_accounts_org_id__organizations_id FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: inbox_ai_flags fk_inbox_ai_flags_conversation_id__conversations_id; Type: FK CONSTRAINT; Schema: public; Owner: cresceja
--

ALTER TABLE ONLY public.inbox_ai_flags
    ADD CONSTRAINT fk_inbox_ai_flags_conversation_id__conversations_id FOREIGN KEY (conversation_id) REFERENCES public.conversations(id) ON DELETE CASCADE;


--
-- Name: inbox_ai_flags fk_inbox_ai_flags_org_id__organizations_id; Type: FK CONSTRAINT; Schema: public; Owner: cresceja
--

ALTER TABLE ONLY public.inbox_ai_flags
    ADD CONSTRAINT fk_inbox_ai_flags_org_id__organizations_id FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: inbox_audit_events fk_inbox_audit_events_actor_id__users_id; Type: FK CONSTRAINT; Schema: public; Owner: cresceja
--

ALTER TABLE ONLY public.inbox_audit_events
    ADD CONSTRAINT fk_inbox_audit_events_actor_id__users_id FOREIGN KEY (actor_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: inbox_audit_events fk_inbox_audit_events_org_id__organizations_id; Type: FK CONSTRAINT; Schema: public; Owner: cresceja
--

ALTER TABLE ONLY public.inbox_audit_events
    ADD CONSTRAINT fk_inbox_audit_events_org_id__organizations_id FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: instagram_accounts fk_instagram_accounts_org_id__organizations_id; Type: FK CONSTRAINT; Schema: public; Owner: cresceja
--

ALTER TABLE ONLY public.instagram_accounts
    ADD CONSTRAINT fk_instagram_accounts_org_id__organizations_id FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: instagram_oauth_tokens fk_instagram_oauth_tokens_account_id__instagram_accounts_id; Type: FK CONSTRAINT; Schema: public; Owner: cresceja
--

ALTER TABLE ONLY public.instagram_oauth_tokens
    ADD CONSTRAINT fk_instagram_oauth_tokens_account_id__instagram_accounts_id FOREIGN KEY (account_id) REFERENCES public.instagram_accounts(id) ON DELETE CASCADE;


--
-- Name: instagram_publish_jobs fk_instagram_publish_jobs_account_id__instagram_accounts_id; Type: FK CONSTRAINT; Schema: public; Owner: cresceja
--

ALTER TABLE ONLY public.instagram_publish_jobs
    ADD CONSTRAINT fk_instagram_publish_jobs_account_id__instagram_accounts_id FOREIGN KEY (account_id) REFERENCES public.instagram_accounts(id) ON DELETE CASCADE;


--
-- Name: instagram_publish_jobs fk_instagram_publish_jobs_org_id__organizations_id; Type: FK CONSTRAINT; Schema: public; Owner: cresceja
--

ALTER TABLE ONLY public.instagram_publish_jobs
    ADD CONSTRAINT fk_instagram_publish_jobs_org_id__organizations_id FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: integration_events fk_integration_events_org_id__organizations_id; Type: FK CONSTRAINT; Schema: public; Owner: cresceja
--

ALTER TABLE ONLY public.integration_events
    ADD CONSTRAINT fk_integration_events_org_id__organizations_id FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: invoices fk_invoices_org_id__organizations_id; Type: FK CONSTRAINT; Schema: public; Owner: cresceja
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT fk_invoices_org_id__organizations_id FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: kb_documents fk_kb_documents_org_id__organizations_id; Type: FK CONSTRAINT; Schema: public; Owner: cresceja
--

ALTER TABLE ONLY public.kb_documents
    ADD CONSTRAINT fk_kb_documents_org_id__organizations_id FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: leads fk_leads_org_id__organizations_id; Type: FK CONSTRAINT; Schema: public; Owner: cresceja
--

ALTER TABLE ONLY public.leads
    ADD CONSTRAINT fk_leads_org_id__organizations_id FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: message_attachments fk_message_attachments_message_id__messages_id; Type: FK CONSTRAINT; Schema: public; Owner: cresceja
--

ALTER TABLE ONLY public.message_attachments
    ADD CONSTRAINT fk_message_attachments_message_id__messages_id FOREIGN KEY (message_id) REFERENCES public.messages(id) ON DELETE CASCADE;


--
-- Name: messages fk_messages_conversation_id__conversations_id; Type: FK CONSTRAINT; Schema: public; Owner: cresceja
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT fk_messages_conversation_id__conversations_id FOREIGN KEY (conversation_id) REFERENCES public.conversations(id) ON DELETE CASCADE;


--
-- Name: messages fk_messages_org_id__organizations_id; Type: FK CONSTRAINT; Schema: public; Owner: cresceja
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT fk_messages_org_id__organizations_id FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: meta_tokens fk_meta_tokens_org_id__organizations_id; Type: FK CONSTRAINT; Schema: public; Owner: cresceja
--

ALTER TABLE ONLY public.meta_tokens
    ADD CONSTRAINT fk_meta_tokens_org_id__organizations_id FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: opportunities fk_opportunities_lead_id__leads_id; Type: FK CONSTRAINT; Schema: public; Owner: cresceja
--

ALTER TABLE ONLY public.opportunities
    ADD CONSTRAINT fk_opportunities_lead_id__leads_id FOREIGN KEY (lead_id) REFERENCES public.leads(id) ON DELETE SET NULL;


--
-- Name: opportunities fk_opportunities_org_id__organizations_id; Type: FK CONSTRAINT; Schema: public; Owner: cresceja
--

ALTER TABLE ONLY public.opportunities
    ADD CONSTRAINT fk_opportunities_org_id__organizations_id FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: org_ai_profiles fk_org_ai_profiles_org_id__organizations_id; Type: FK CONSTRAINT; Schema: public; Owner: cresceja
--

ALTER TABLE ONLY public.org_ai_profiles
    ADD CONSTRAINT fk_org_ai_profiles_org_id__organizations_id FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: org_ai_settings fk_org_ai_settings_org_id__organizations_id; Type: FK CONSTRAINT; Schema: public; Owner: cresceja
--

ALTER TABLE ONLY public.org_ai_settings
    ADD CONSTRAINT fk_org_ai_settings_org_id__organizations_id FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: org_features fk_org_features_org_id__organizations_id; Type: FK CONSTRAINT; Schema: public; Owner: cresceja
--

ALTER TABLE ONLY public.org_features
    ADD CONSTRAINT fk_org_features_org_id__organizations_id FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: org_integration_logs fk_org_integration_logs_org_id__organizations_id; Type: FK CONSTRAINT; Schema: public; Owner: cresceja
--

ALTER TABLE ONLY public.org_integration_logs
    ADD CONSTRAINT fk_org_integration_logs_org_id__organizations_id FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: org_integrations fk_org_integrations_org_id__organizations_id; Type: FK CONSTRAINT; Schema: public; Owner: cresceja
--

ALTER TABLE ONLY public.org_integrations
    ADD CONSTRAINT fk_org_integrations_org_id__organizations_id FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: org_plan_history fk_org_plan_history_org_id__organizations_id; Type: FK CONSTRAINT; Schema: public; Owner: cresceja
--

ALTER TABLE ONLY public.org_plan_history
    ADD CONSTRAINT fk_org_plan_history_org_id__organizations_id FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: org_plan_history fk_org_plan_history_plan_id__plans_id; Type: FK CONSTRAINT; Schema: public; Owner: cresceja
--

ALTER TABLE ONLY public.org_plan_history
    ADD CONSTRAINT fk_org_plan_history_plan_id__plans_id FOREIGN KEY (plan_id) REFERENCES public.plans(id) ON DELETE SET NULL;


--
-- Name: org_settings fk_org_settings_org_id__organizations_id; Type: FK CONSTRAINT; Schema: public; Owner: cresceja
--

ALTER TABLE ONLY public.org_settings
    ADD CONSTRAINT fk_org_settings_org_id__organizations_id FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: org_subscriptions fk_org_subscriptions_org_id__organizations_id; Type: FK CONSTRAINT; Schema: public; Owner: cresceja
--

ALTER TABLE ONLY public.org_subscriptions
    ADD CONSTRAINT fk_org_subscriptions_org_id__organizations_id FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: org_subscriptions fk_org_subscriptions_plan_id__plans_id; Type: FK CONSTRAINT; Schema: public; Owner: cresceja
--

ALTER TABLE ONLY public.org_subscriptions
    ADD CONSTRAINT fk_org_subscriptions_plan_id__plans_id FOREIGN KEY (plan_id) REFERENCES public.plans(id) ON DELETE SET NULL;


--
-- Name: org_users fk_org_users_org_id__organizations_id; Type: FK CONSTRAINT; Schema: public; Owner: cresceja
--

ALTER TABLE ONLY public.org_users
    ADD CONSTRAINT fk_org_users_org_id__organizations_id FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: org_users fk_org_users_user_id__users_id; Type: FK CONSTRAINT; Schema: public; Owner: cresceja
--

ALTER TABLE ONLY public.org_users
    ADD CONSTRAINT fk_org_users_user_id__users_id FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: payments fk_payments_org_id__organizations_id; Type: FK CONSTRAINT; Schema: public; Owner: cresceja
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT fk_payments_org_id__organizations_id FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: plan_credits fk_plan_credits_plan_id__plans_id; Type: FK CONSTRAINT; Schema: public; Owner: cresceja
--

ALTER TABLE ONLY public.plan_credits
    ADD CONSTRAINT fk_plan_credits_plan_id__plans_id FOREIGN KEY (plan_id) REFERENCES public.plans(id) ON DELETE CASCADE;


--
-- Name: plan_features fk_plan_features_plan_id__plans_id; Type: FK CONSTRAINT; Schema: public; Owner: cresceja
--

ALTER TABLE ONLY public.plan_features
    ADD CONSTRAINT fk_plan_features_plan_id__plans_id FOREIGN KEY (plan_id) REFERENCES public.plans(id) ON DELETE CASCADE;


--
-- Name: plans_meta fk_plans_meta_plan_id__plans_id; Type: FK CONSTRAINT; Schema: public; Owner: cresceja
--

ALTER TABLE ONLY public.plans_meta
    ADD CONSTRAINT fk_plans_meta_plan_id__plans_id FOREIGN KEY (plan_id) REFERENCES public.plans(id) ON DELETE CASCADE;


--
-- Name: post_approvals fk_post_approvals_approver_id__users_id; Type: FK CONSTRAINT; Schema: public; Owner: cresceja
--

ALTER TABLE ONLY public.post_approvals
    ADD CONSTRAINT fk_post_approvals_approver_id__users_id FOREIGN KEY (approver_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: post_approvals fk_post_approvals_post_id__posts_id; Type: FK CONSTRAINT; Schema: public; Owner: cresceja
--

ALTER TABLE ONLY public.post_approvals
    ADD CONSTRAINT fk_post_approvals_post_id__posts_id FOREIGN KEY (post_id) REFERENCES public.posts(id) ON DELETE CASCADE;


--
-- Name: purchases fk_purchases_org_id__organizations_id; Type: FK CONSTRAINT; Schema: public; Owner: cresceja
--

ALTER TABLE ONLY public.purchases
    ADD CONSTRAINT fk_purchases_org_id__organizations_id FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: quick_replies fk_quick_replies_company_id__organizations_id; Type: FK CONSTRAINT; Schema: public; Owner: cresceja
--

ALTER TABLE ONLY public.quick_replies
    ADD CONSTRAINT fk_quick_replies_company_id__organizations_id FOREIGN KEY (company_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: repurpose_jobs fk_repurpose_jobs_post_id__posts_id; Type: FK CONSTRAINT; Schema: public; Owner: cresceja
--

ALTER TABLE ONLY public.repurpose_jobs
    ADD CONSTRAINT fk_repurpose_jobs_post_id__posts_id FOREIGN KEY (post_id) REFERENCES public.posts(id) ON DELETE CASCADE;


--
-- Name: subscriptions fk_subscriptions_org_id__organizations_id; Type: FK CONSTRAINT; Schema: public; Owner: cresceja
--

ALTER TABLE ONLY public.subscriptions
    ADD CONSTRAINT fk_subscriptions_org_id__organizations_id FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: support_tickets fk_support_tickets_org_id__organizations_id; Type: FK CONSTRAINT; Schema: public; Owner: cresceja
--

ALTER TABLE ONLY public.support_tickets
    ADD CONSTRAINT fk_support_tickets_org_id__organizations_id FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: tags fk_tags_org_id__organizations_id; Type: FK CONSTRAINT; Schema: public; Owner: cresceja
--

ALTER TABLE ONLY public.tags
    ADD CONSTRAINT fk_tags_org_id__organizations_id FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: telemetry_events fk_telemetry_events_org_id__organizations_id; Type: FK CONSTRAINT; Schema: public; Owner: cresceja
--

ALTER TABLE ONLY public.telemetry_events
    ADD CONSTRAINT fk_telemetry_events_org_id__organizations_id FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: telemetry_events fk_telemetry_events_user_id__users_id; Type: FK CONSTRAINT; Schema: public; Owner: cresceja
--

ALTER TABLE ONLY public.telemetry_events
    ADD CONSTRAINT fk_telemetry_events_user_id__users_id FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: telemetry_kpis_daily fk_telemetry_kpis_daily_org_id__organizations_id; Type: FK CONSTRAINT; Schema: public; Owner: cresceja
--

ALTER TABLE ONLY public.telemetry_kpis_daily
    ADD CONSTRAINT fk_telemetry_kpis_daily_org_id__organizations_id FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: usage_counters fk_usage_counters_client_id__clients_id; Type: FK CONSTRAINT; Schema: public; Owner: cresceja
--

ALTER TABLE ONLY public.usage_counters
    ADD CONSTRAINT fk_usage_counters_client_id__clients_id FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE CASCADE;


--
-- Name: usage_reports fk_usage_reports_org_id__organizations_id; Type: FK CONSTRAINT; Schema: public; Owner: cresceja
--

ALTER TABLE ONLY public.usage_reports
    ADD CONSTRAINT fk_usage_reports_org_id__organizations_id FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: user_orgs fk_user_orgs_org_id__organizations_id; Type: FK CONSTRAINT; Schema: public; Owner: cresceja
--

ALTER TABLE ONLY public.user_orgs
    ADD CONSTRAINT fk_user_orgs_org_id__organizations_id FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: user_orgs fk_user_orgs_user_id__users_id; Type: FK CONSTRAINT; Schema: public; Owner: cresceja
--

ALTER TABLE ONLY public.user_orgs
    ADD CONSTRAINT fk_user_orgs_user_id__users_id FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: users fk_users_org_id__organizations_id; Type: FK CONSTRAINT; Schema: public; Owner: cresceja
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT fk_users_org_id__organizations_id FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE SET NULL;


--
-- Name: whatsapp_channels fk_whatsapp_channels_org_id__organizations_id; Type: FK CONSTRAINT; Schema: public; Owner: cresceja
--

ALTER TABLE ONLY public.whatsapp_channels
    ADD CONSTRAINT fk_whatsapp_channels_org_id__organizations_id FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--

\unrestrict cnq6d0maMvIwaPnh42uu7enofA8k0TV7nIJhQVOmhnc3Fs09FV3OZaavIDW8X6P

