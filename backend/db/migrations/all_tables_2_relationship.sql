/* CresceJá — Full bootstrap schema (auto-generated)
   This creates core tables (orgs/users) and all multitenant tables found
   in your RLS report, with sensible columns and relationships.
   Adjust as needed for your app specifics.
*/
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS citext;

-- CORE: orgs, users, user_orgs, support_audit_logs
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='orgs') THEN
    CREATE TABLE public.orgs (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      name text NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now()
    );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='users') THEN
    CREATE TABLE public.users (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      name text,
      email citext UNIQUE NOT NULL,
      password_hash text,
      role text NOT NULL DEFAULT 'OrgViewer',
      is_support boolean NOT NULL DEFAULT false,
      support_scopes text[] NOT NULL DEFAULT '{}',
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON public.users(email);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='user_orgs') THEN
    CREATE TABLE public.user_orgs (
      user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
      org_id uuid NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
      role text NOT NULL DEFAULT 'OrgViewer',
      perms jsonb NOT NULL DEFAULT '{}'::jsonb,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY (user_id, org_id)
    );
    CREATE INDEX IF NOT EXISTS idx_user_orgs_org ON public.user_orgs(org_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='user_global_roles') THEN
    CREATE TABLE public.user_global_roles (
      user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
      role text NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY (user_id, role)
    );
    CREATE INDEX IF NOT EXISTS idx_user_global_roles_user ON public.user_global_roles(user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='support_audit_logs') THEN
    CREATE TABLE public.support_audit_logs (
      id bigserial PRIMARY KEY,
      actor_user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
      target_org_id uuid NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
      path text NOT NULL,
      method text NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS idx_support_audit_logs_org ON public.support_audit_logs(target_org_id, created_at);
  END IF;
END $$;

DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='ai_credit_usage'
        ) THEN
          CREATE TABLE public.ai_credit_usage (
            id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            org_id uuid NOT NULL,
            created_at timestamptz NOT NULL DEFAULT now(),
            updated_at timestamptz NOT NULL DEFAULT now(),
user_id uuid,
category text, -- atendimento|conteudo
amount int NOT NULL DEFAULT 0,
notes text
          );
        END IF;
      END $$;

DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='ai_usage_logs'
        ) THEN
          CREATE TABLE public.ai_usage_logs (
            id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            org_id uuid NOT NULL,
            created_at timestamptz NOT NULL DEFAULT now(),
            updated_at timestamptz NOT NULL DEFAULT now(),
model text,
prompt_tokens int DEFAULT 0,
completion_tokens int DEFAULT 0,
total_tokens int DEFAULT 0,
cost_usd numeric(12,6) DEFAULT 0,
tool text,
ref_type text,
ref_id uuid
          );
        END IF;
      END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='appointments'
  ) THEN
    CREATE TABLE public.appointments (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      org_id uuid NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );
  END IF;
END $$;

DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='assets'
        ) THEN
          CREATE TABLE public.assets (
            id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            org_id uuid NOT NULL,
            created_at timestamptz NOT NULL DEFAULT now(),
            updated_at timestamptz NOT NULL DEFAULT now(),
owner_type text,
owner_id uuid,
file_name text,
mime_type text,
size_bytes bigint,
url text
          );
        END IF;
      END $$;

DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='audit_logs'
        ) THEN
          CREATE TABLE public.audit_logs (
            id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            org_id uuid NOT NULL,
            created_at timestamptz NOT NULL DEFAULT now(),
            updated_at timestamptz NOT NULL DEFAULT now(),
actor_user_id uuid,
action text,
entity_type text,
entity_id uuid,
details jsonb NOT NULL DEFAULT '{}'::jsonb
          );
        END IF;
      END $$;

DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='calendar_events'
        ) THEN
          CREATE TABLE public.calendar_events (
            id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            org_id uuid NOT NULL,
            created_at timestamptz NOT NULL DEFAULT now(),
            updated_at timestamptz NOT NULL DEFAULT now(),
calendar_id uuid NOT NULL,
title text NOT NULL,
description text,
location text,
start_time timestamptz NOT NULL,
end_time timestamptz NOT NULL,
status text
          );
        END IF;
      END $$;

DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='calendar_integrations'
        ) THEN
          CREATE TABLE public.calendar_integrations (
            id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            org_id uuid NOT NULL,
            created_at timestamptz NOT NULL DEFAULT now(),
            updated_at timestamptz NOT NULL DEFAULT now(),
provider text NOT NULL,
external_id text,
config jsonb NOT NULL DEFAULT '{}'::jsonb
          );
        END IF;
      END $$;

DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='calendar_members'
        ) THEN
          CREATE TABLE public.calendar_members (
            id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            org_id uuid NOT NULL,
            created_at timestamptz NOT NULL DEFAULT now(),
            updated_at timestamptz NOT NULL DEFAULT now(),
calendar_id uuid NOT NULL,
user_id uuid NOT NULL,
role text NOT NULL DEFAULT 'member'
          );
        END IF;
      END $$;

DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='calendars'
        ) THEN
          CREATE TABLE public.calendars (
            id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            org_id uuid NOT NULL,
            created_at timestamptz NOT NULL DEFAULT now(),
            updated_at timestamptz NOT NULL DEFAULT now(),
name text NOT NULL,
timezone text NOT NULL DEFAULT 'UTC'
          );
        END IF;
      END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='channel_id_map'
  ) THEN
    CREATE TABLE public.channel_id_map (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      org_id uuid NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );
  END IF;
END $$;

DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='channels'
        ) THEN
          CREATE TABLE public.channels (
            id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            org_id uuid NOT NULL,
            created_at timestamptz NOT NULL DEFAULT now(),
            updated_at timestamptz NOT NULL DEFAULT now(),
provider text NOT NULL,
config jsonb NOT NULL DEFAULT '{}'::jsonb
          );
        END IF;
      END $$;

DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='clients'
        ) THEN
          CREATE TABLE public.clients (
            id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            org_id uuid NOT NULL,
            created_at timestamptz NOT NULL DEFAULT now(),
            updated_at timestamptz NOT NULL DEFAULT now(),
name text,
email citext,
phone text,
tags text[] NOT NULL DEFAULT '{}'
          );
        END IF;
      END $$;

DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='contact_tags'
        ) THEN
          CREATE TABLE public.contact_tags (
            id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            org_id uuid NOT NULL,
            created_at timestamptz NOT NULL DEFAULT now(),
            updated_at timestamptz NOT NULL DEFAULT now(),
contact_id uuid NOT NULL,
tag text NOT NULL
          );
        END IF;
      END $$;

DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='contacts'
        ) THEN
          CREATE TABLE public.contacts (
            id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            org_id uuid NOT NULL,
            created_at timestamptz NOT NULL DEFAULT now(),
            updated_at timestamptz NOT NULL DEFAULT now(),
client_id uuid,
name text,
email citext,
phone text
          );
        END IF;
      END $$;

DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='conversations'
        ) THEN
          CREATE TABLE public.conversations (
            id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            org_id uuid NOT NULL,
            created_at timestamptz NOT NULL DEFAULT now(),
            updated_at timestamptz NOT NULL DEFAULT now(),
client_id uuid,
channel_id uuid,
status text DEFAULT 'open',
unread_count int NOT NULL DEFAULT 0,
last_message_at timestamptz
          );
        END IF;
      END $$;

DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='crm_opportunities'
        ) THEN
          CREATE TABLE public.crm_opportunities (
            id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            org_id uuid NOT NULL,
            created_at timestamptz NOT NULL DEFAULT now(),
            updated_at timestamptz NOT NULL DEFAULT now(),
client_id uuid,
title text NOT NULL,
amount numeric(14,2) DEFAULT 0,
currency text DEFAULT 'BRL',
stage text,
status text DEFAULT 'open',
probability numeric(5,2),
close_date date
          );
        END IF;
      END $$;

DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='email_automation_steps'
        ) THEN
          CREATE TABLE public.email_automation_steps (
            id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            org_id uuid NOT NULL,
            created_at timestamptz NOT NULL DEFAULT now(),
            updated_at timestamptz NOT NULL DEFAULT now(),
automation_id uuid NOT NULL,
step_order int NOT NULL,
kind text NOT NULL,
config jsonb NOT NULL DEFAULT '{}'::jsonb
          );
        END IF;
      END $$;

DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='email_automations'
        ) THEN
          CREATE TABLE public.email_automations (
            id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            org_id uuid NOT NULL,
            created_at timestamptz NOT NULL DEFAULT now(),
            updated_at timestamptz NOT NULL DEFAULT now(),
name text NOT NULL,
status text DEFAULT 'active',
definition jsonb NOT NULL DEFAULT '{}'::jsonb
          );
        END IF;
      END $$;

DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='email_campaign_recipients'
        ) THEN
          CREATE TABLE public.email_campaign_recipients (
            id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            org_id uuid NOT NULL,
            created_at timestamptz NOT NULL DEFAULT now(),
            updated_at timestamptz NOT NULL DEFAULT now(),
campaign_id uuid NOT NULL,
contact_id uuid NOT NULL,
status text DEFAULT 'queued'
          );
        END IF;
      END $$;

DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='email_campaigns'
        ) THEN
          CREATE TABLE public.email_campaigns (
            id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            org_id uuid NOT NULL,
            created_at timestamptz NOT NULL DEFAULT now(),
            updated_at timestamptz NOT NULL DEFAULT now(),
name text NOT NULL,
subject text,
from_name text,
from_email citext,
status text DEFAULT 'draft',
scheduled_at timestamptz
          );
        END IF;
      END $$;

DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='email_events'
        ) THEN
          CREATE TABLE public.email_events (
            id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            org_id uuid NOT NULL,
            created_at timestamptz NOT NULL DEFAULT now(),
            updated_at timestamptz NOT NULL DEFAULT now(),
campaign_id uuid,
contact_id uuid,
event_type text,
event_at timestamptz NOT NULL DEFAULT now(),
payload jsonb NOT NULL DEFAULT '{}'::jsonb
          );
        END IF;
      END $$;

DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='email_lists'
        ) THEN
          CREATE TABLE public.email_lists (
            id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            org_id uuid NOT NULL,
            created_at timestamptz NOT NULL DEFAULT now(),
            updated_at timestamptz NOT NULL DEFAULT now(),
name text NOT NULL,
description text
          );
        END IF;
      END $$;

DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='email_segments'
        ) THEN
          CREATE TABLE public.email_segments (
            id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            org_id uuid NOT NULL,
            created_at timestamptz NOT NULL DEFAULT now(),
            updated_at timestamptz NOT NULL DEFAULT now(),
list_id uuid,
name text NOT NULL,
criteria jsonb NOT NULL DEFAULT '{}'::jsonb
          );
        END IF;
      END $$;

DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='email_subscriptions'
        ) THEN
          CREATE TABLE public.email_subscriptions (
            id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            org_id uuid NOT NULL,
            created_at timestamptz NOT NULL DEFAULT now(),
            updated_at timestamptz NOT NULL DEFAULT now(),
list_id uuid,
contact_id uuid,
status text DEFAULT 'subscribed'
          );
        END IF;
      END $$;

DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='email_templates'
        ) THEN
          CREATE TABLE public.email_templates (
            id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            org_id uuid NOT NULL,
            created_at timestamptz NOT NULL DEFAULT now(),
            updated_at timestamptz NOT NULL DEFAULT now(),
name text NOT NULL,
content jsonb NOT NULL DEFAULT '{}'::jsonb,
status text DEFAULT 'active'
          );
        END IF;
      END $$;

DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='invoices'
        ) THEN
          CREATE TABLE public.invoices (
            id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            org_id uuid NOT NULL,
            created_at timestamptz NOT NULL DEFAULT now(),
            updated_at timestamptz NOT NULL DEFAULT now(),
subscription_id uuid,
amount numeric(14,2),
currency text DEFAULT 'BRL',
status text DEFAULT 'open',
due_date date,
paid_at timestamptz
          );
        END IF;
      END $$;

DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='leads'
        ) THEN
          CREATE TABLE public.leads (
            id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            org_id uuid NOT NULL,
            created_at timestamptz NOT NULL DEFAULT now(),
            updated_at timestamptz NOT NULL DEFAULT now(),
name text,
email citext,
phone text,
source text,
status text DEFAULT 'new',
notes text
          );
        END IF;
      END $$;

DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='lgpd_consents'
        ) THEN
          CREATE TABLE public.lgpd_consents (
            id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            org_id uuid NOT NULL,
            created_at timestamptz NOT NULL DEFAULT now(),
            updated_at timestamptz NOT NULL DEFAULT now(),
client_id uuid,
purpose text,
granted boolean NOT NULL DEFAULT true,
granted_at timestamptz NOT NULL DEFAULT now()
          );
        END IF;
      END $$;

DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='lgpd_erasure_requests'
        ) THEN
          CREATE TABLE public.lgpd_erasure_requests (
            id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            org_id uuid NOT NULL,
            created_at timestamptz NOT NULL DEFAULT now(),
            updated_at timestamptz NOT NULL DEFAULT now(),
client_id uuid,
status text DEFAULT 'pending',
requested_at timestamptz NOT NULL DEFAULT now(),
processed_at timestamptz
          );
        END IF;
      END $$;

DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='message_attachments'
        ) THEN
          CREATE TABLE public.message_attachments (
            id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            org_id uuid NOT NULL,
            created_at timestamptz NOT NULL DEFAULT now(),
            updated_at timestamptz NOT NULL DEFAULT now(),
message_id uuid NOT NULL,
file_name text,
mime_type text,
size_bytes bigint,
url text
          );
        END IF;
      END $$;

DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='message_templates'
        ) THEN
          CREATE TABLE public.message_templates (
            id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            org_id uuid NOT NULL,
            created_at timestamptz NOT NULL DEFAULT now(),
            updated_at timestamptz NOT NULL DEFAULT now(),
name text NOT NULL,
content jsonb NOT NULL DEFAULT '{}'::jsonb,
status text DEFAULT 'active'
          );
        END IF;
      END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='message_transcripts'
  ) THEN
    CREATE TABLE public.message_transcripts (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      org_id uuid NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );
  END IF;
END $$;

DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='messages'
        ) THEN
          CREATE TABLE public.messages (
            id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            org_id uuid NOT NULL,
            created_at timestamptz NOT NULL DEFAULT now(),
            updated_at timestamptz NOT NULL DEFAULT now(),
conversation_id uuid NOT NULL,
sender_id uuid,
sender_type text,
direction text, -- inbound/outbound
msg_type text,
body text,
status text,
provider_message_id text
          );
        END IF;
      END $$;

DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='nps_responses'
        ) THEN
          CREATE TABLE public.nps_responses (
            id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            org_id uuid NOT NULL,
            created_at timestamptz NOT NULL DEFAULT now(),
            updated_at timestamptz NOT NULL DEFAULT now(),
survey_id uuid NOT NULL,
client_id uuid,
rating int NOT NULL,
comment text
          );
        END IF;
      END $$;

DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='nps_surveys'
        ) THEN
          CREATE TABLE public.nps_surveys (
            id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            org_id uuid NOT NULL,
            created_at timestamptz NOT NULL DEFAULT now(),
            updated_at timestamptz NOT NULL DEFAULT now(),
title text NOT NULL,
active boolean NOT NULL DEFAULT true,
starts_at timestamptz,
ends_at timestamptz
          );
        END IF;
      END $$;

DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='onboarding_tasks'
        ) THEN
          CREATE TABLE public.onboarding_tasks (
            id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            org_id uuid NOT NULL,
            created_at timestamptz NOT NULL DEFAULT now(),
            updated_at timestamptz NOT NULL DEFAULT now(),
title text NOT NULL,
description text,
status text NOT NULL DEFAULT 'pending',
assigned_to uuid,
due_date date
          );
        END IF;
      END $$;

DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='org_ai_settings'
        ) THEN
          CREATE TABLE public.org_ai_settings (
            id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            org_id uuid NOT NULL,
            created_at timestamptz NOT NULL DEFAULT now(),
            updated_at timestamptz NOT NULL DEFAULT now(),
settings jsonb NOT NULL DEFAULT '{}'::jsonb
          );
        END IF;
      END $$;

DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='org_users'
        ) THEN
          CREATE TABLE public.org_users (
            id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            org_id uuid NOT NULL,
            created_at timestamptz NOT NULL DEFAULT now(),
            updated_at timestamptz NOT NULL DEFAULT now(),
user_id uuid NOT NULL,
role text NOT NULL DEFAULT 'OrgViewer',
perms jsonb NOT NULL DEFAULT '{}'::jsonb
          );
        END IF;
      END $$;

DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='posts'
        ) THEN
          CREATE TABLE public.posts (
            id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            org_id uuid NOT NULL,
            created_at timestamptz NOT NULL DEFAULT now(),
            updated_at timestamptz NOT NULL DEFAULT now(),
title text NOT NULL,
content jsonb NOT NULL DEFAULT '{}'::jsonb,
status text NOT NULL DEFAULT 'draft'
          );
        END IF;
      END $$;

DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='repurpose_jobs'
        ) THEN
          CREATE TABLE public.repurpose_jobs (
            id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            org_id uuid NOT NULL,
            created_at timestamptz NOT NULL DEFAULT now(),
            updated_at timestamptz NOT NULL DEFAULT now(),
source_type text,
source_id uuid,
target_type text,
params jsonb NOT NULL DEFAULT '{}'::jsonb,
status text DEFAULT 'queued'
          );
        END IF;
      END $$;

DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='rewards'
        ) THEN
          CREATE TABLE public.rewards (
            id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            org_id uuid NOT NULL,
            created_at timestamptz NOT NULL DEFAULT now(),
            updated_at timestamptz NOT NULL DEFAULT now(),
name text NOT NULL,
points int NOT NULL DEFAULT 0,
active boolean NOT NULL DEFAULT true
          );
        END IF;
      END $$;

DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='social_posts'
        ) THEN
          CREATE TABLE public.social_posts (
            id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            org_id uuid NOT NULL,
            created_at timestamptz NOT NULL DEFAULT now(),
            updated_at timestamptz NOT NULL DEFAULT now(),
post_id uuid,
channel_id uuid,
scheduled_at timestamptz,
published_at timestamptz,
status text DEFAULT 'scheduled'
          );
        END IF;
      END $$;

DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='subscriptions'
        ) THEN
          CREATE TABLE public.subscriptions (
            id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            org_id uuid NOT NULL,
            created_at timestamptz NOT NULL DEFAULT now(),
            updated_at timestamptz NOT NULL DEFAULT now(),
plan text NOT NULL,
status text NOT NULL DEFAULT 'active',
period_start timestamptz,
period_end timestamptz,
external_customer_id text,
external_subscription_id text
          );
        END IF;
      END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='tags'
  ) THEN
    CREATE TABLE public.tags (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      org_id uuid NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );
  END IF;
END $$;

DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='usage_counters'
        ) THEN
          CREATE TABLE public.usage_counters (
            id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            org_id uuid NOT NULL,
            created_at timestamptz NOT NULL DEFAULT now(),
            updated_at timestamptz NOT NULL DEFAULT now(),
key text NOT NULL,
period text NOT NULL,
value bigint NOT NULL DEFAULT 0
          );
        END IF;
      END $$;

DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='user_orgs'
        ) THEN
          CREATE TABLE public.user_orgs (
            id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            org_id uuid NOT NULL,
            created_at timestamptz NOT NULL DEFAULT now(),
            updated_at timestamptz NOT NULL DEFAULT now(),
user_id uuid NOT NULL,
role text NOT NULL DEFAULT 'OrgViewer',
perms jsonb NOT NULL DEFAULT '{}'::jsonb
          );
        END IF;
      END $$;

DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='whatsapp_templates'
        ) THEN
          CREATE TABLE public.whatsapp_templates (
            id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            org_id uuid NOT NULL,
            created_at timestamptz NOT NULL DEFAULT now(),
            updated_at timestamptz NOT NULL DEFAULT now(),
name text NOT NULL,
content jsonb NOT NULL DEFAULT '{}'::jsonb,
status text DEFAULT 'active'
          );
        END IF;
      END $$;

-- Relationships & RLS baseline for all tables with org_id
DO $$ DECLARE r record; BEGIN
  FOR r IN
    SELECT table_name FROM information_schema.columns
    WHERE table_schema='public' AND column_name='org_id'
  LOOP
    EXECUTE format('
      DO $$ BEGIN
        BEGIN
          ALTER TABLE public.%I
            ADD CONSTRAINT %I FOREIGN KEY (org_id) REFERENCES public.orgs(id) ON DELETE CASCADE;
        EXCEPTION WHEN duplicate_object THEN NULL;
        END;
      END $$;', r.table_name, r.table_name || '_org_fk');

    EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON public.%I(org_id)', 'idx_'||r.table_name||'_org', r.table_name);

    -- Optional compound indexes when columns exist
    PERFORM 1 FROM information_schema.columns WHERE table_schema='public' AND table_name=r.table_name AND column_name='updated_at';
    IF FOUND THEN
      EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON public.%I(org_id, updated_at)',
        'idx_'||r.table_name||'_org_updated', r.table_name);
    END IF;

    PERFORM 1 FROM information_schema.columns WHERE table_schema='public' AND table_name=r.table_name AND column_name='status';
    IF FOUND THEN
      EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON public.%I(org_id, status)',
        'idx_'||r.table_name||'_org_status', r.table_name);
    END IF;

    PERFORM 1 FROM information_schema.columns WHERE table_schema='public' AND table_name=r.table_name AND column_name='stage';
    IF FOUND THEN
      EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON public.%I(org_id, stage)',
        'idx_'||r.table_name||'_org_stage', r.table_name);
    END IF;

    -- Enable RLS and create policy
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', r.table_name);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.table_name||'_isolation', r.table_name);
    EXECUTE format('CREATE POLICY %I ON public.%I USING (org_id = current_setting(''app.org_id'')::uuid) WITH CHECK (org_id = current_setting(''app.org_id'')::uuid)',
      r.table_name||'_isolation', r.table_name);
  END LOOP;
END $$;

-- Helpful FKs between known pairs (created if both tables/columns exist)
DO $$ BEGIN
  -- conversations -> clients
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='conversations' AND column_name='client_id')
     AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='clients') THEN
    BEGIN
      ALTER TABLE public.conversations
        ADD CONSTRAINT conversations_client_fk FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE SET NULL;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
  END IF;

  -- messages -> conversations
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='messages' AND column_name='conversation_id')
     AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='conversations') THEN
    BEGIN
      ALTER TABLE public.messages
        ADD CONSTRAINT messages_conversation_fk FOREIGN KEY (conversation_id) REFERENCES public.conversations(id) ON DELETE CASCADE;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
  END IF;

  -- message_attachments -> messages
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='message_attachments' AND column_name='message_id')
     AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='messages') THEN
    BEGIN
      ALTER TABLE public.message_attachments
        ADD CONSTRAINT message_attachments_message_fk FOREIGN KEY (message_id) REFERENCES public.messages(id) ON DELETE CASCADE;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
  END IF;

  -- crm_opportunities -> clients
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='crm_opportunities' AND column_name='client_id')
     AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='clients') THEN
    BEGIN
      ALTER TABLE public.crm_opportunities
        ADD CONSTRAINT crm_opportunities_client_fk FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE SET NULL;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
  END IF;

  -- calendar_events -> calendars
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='calendar_events' AND column_name='calendar_id')
     AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='calendars') THEN
    BEGIN
      ALTER TABLE public.calendar_events
        ADD CONSTRAINT calendar_events_calendar_fk FOREIGN KEY (calendar_id) REFERENCES public.calendars(id) ON DELETE CASCADE;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
  END IF;

  -- social_posts -> posts & channels
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='social_posts' AND column_name='post_id')
     AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='posts') THEN
    BEGIN
      ALTER TABLE public.social_posts
        ADD CONSTRAINT social_posts_post_fk FOREIGN KEY (post_id) REFERENCES public.posts(id) ON DELETE CASCADE;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='social_posts' AND column_name='channel_id')
     AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='channels') THEN
    BEGIN
      ALTER TABLE public.social_posts
        ADD CONSTRAINT social_posts_channel_fk FOREIGN KEY (channel_id) REFERENCES public.channels(id) ON DELETE CASCADE;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
  END IF;

  -- email_* relationships
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='email_campaigns')
     AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='email_campaign_recipients' AND column_name='campaign_id') THEN
    BEGIN
      ALTER TABLE public.email_campaign_recipients
        ADD CONSTRAINT email_campaign_recipients_campaign_fk FOREIGN KEY (campaign_id) REFERENCES public.email_campaigns(id) ON DELETE CASCADE;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='email_events' AND column_name='campaign_id')
     AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='email_campaigns') THEN
    BEGIN
      ALTER TABLE public.email_events
        ADD CONSTRAINT email_events_campaign_fk FOREIGN KEY (campaign_id) REFERENCES public.email_campaigns(id) ON DELETE SET NULL;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='email_automation_steps' AND column_name='automation_id')
     AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='email_automations') THEN
    BEGIN
      ALTER TABLE public.email_automation_steps
        ADD CONSTRAINT email_automation_steps_automation_fk FOREIGN KEY (automation_id) REFERENCES public.email_automations(id) ON DELETE CASCADE;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
  END IF;

END $$;


-- ===========================
-- CresceJá — Inbox Omnichannel (WA/IG/FB)
-- Schema + RLS + índices + triggers
-- Usa org_ai_settings como store de configs da IA
-- ===========================

-- 1) Garante função de trigger (seguro repetir)
CREATE OR REPLACE FUNCTION set_timestamp()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $func$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END
$func$;

-- 2) Completa as colunas exigidas pelo novo schema do Inbox
ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS org_id uuid,
  ADD COLUMN IF NOT EXISTS conversation_id uuid,
  ADD COLUMN IF NOT EXISTS "from" text,
  ADD COLUMN IF NOT EXISTS provider text,
  ADD COLUMN IF NOT EXISTS provider_message_id text,
  ADD COLUMN IF NOT EXISTS type text,
  ADD COLUMN IF NOT EXISTS text text,
  ADD COLUMN IF NOT EXISTS emojis_json jsonb,
  ADD COLUMN IF NOT EXISTS attachments jsonb,
  ADD COLUMN IF NOT EXISTS status text,
  ADD COLUMN IF NOT EXISTS transcript text,
  ADD COLUMN IF NOT EXISTS meta jsonb,
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- 3) Normaliza valores nulos (opcional, mas útil)
UPDATE public.messages SET meta = '{}'::jsonb WHERE meta IS NULL;

-- 4) Recria trigger de updated_at
DROP TRIGGER IF EXISTS set_messages_updated_at ON public.messages;
CREATE TRIGGER set_messages_updated_at
BEFORE UPDATE ON public.messages
FOR EACH ROW EXECUTE FUNCTION set_timestamp();

-- 5) (Re)cria índices de forma segura, só se a coluna existir
DO $$
BEGIN
  -- por conversa + data (usado no histórico)
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema='public' AND table_name='messages'
               AND column_name='conversation_id') THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_messages_conv_created ON public.messages(conversation_id, created_at DESC)';
  END IF;

  -- por org (RLS + consultas gerais)
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema='public' AND table_name='messages'
               AND column_name='org_id') THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_messages_org ON public.messages(org_id)';
  END IF;

  -- GIN em meta (usado para filtros/flags flexíveis)
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema='public' AND table_name='messages'
               AND column_name='meta') THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_messages_meta_gin ON public.messages USING GIN (meta)';
  END IF;
END
$$;

-- 6) (opcional) Habilita/política RLS se ainda não estiverem ativas
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

DO $rls$
BEGIN
  DROP POLICY IF EXISTS messages_isolation ON public.messages;
  CREATE POLICY messages_isolation ON public.messages
    USING (org_id = current_setting('app.org_id', true)::uuid)
    WITH CHECK (org_id = current_setting('app.org_id', true)::uuid);
END
$rls$;

-- Garante que a tabela contacts tem as colunas necessárias
ALTER TABLE public.contacts
  ADD COLUMN IF NOT EXISTS org_id uuid,
  ADD COLUMN IF NOT EXISTS provider_user_id text,
  ADD COLUMN IF NOT EXISTS name text,
  ADD COLUMN IF NOT EXISTS first_name text,
  ADD COLUMN IF NOT EXISTS cpf text,
  ADD COLUMN IF NOT EXISTS phone_e164 text,
  ADD COLUMN IF NOT EXISTS email text,
  ADD COLUMN IF NOT EXISTS birthdate date,
  ADD COLUMN IF NOT EXISTS photo_url text,
  ADD COLUMN IF NOT EXISTS tags text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS notes text,
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- Recria a trigger de updated_at
CREATE OR REPLACE FUNCTION set_timestamp()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $func$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END
$func$;

DROP TRIGGER IF EXISTS set_contacts_updated_at ON public.contacts;
CREATE TRIGGER set_contacts_updated_at
BEFORE UPDATE ON public.contacts
FOR EACH ROW EXECUTE FUNCTION set_timestamp();

-- Cria o índice somente se a coluna existir
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public'
      AND table_name='contacts'
      AND column_name='phone_e164'
  ) THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_contacts_phone ON public.contacts(phone_e164)';
  END IF;
END
$$;

-- (Opcional) RLS se ainda não tiver
ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;

DO $rls$
BEGIN
  DROP POLICY IF EXISTS contacts_isolation ON public.contacts;
  CREATE POLICY contacts_isolation ON public.contacts
    USING (org_id = current_setting('app.org_id', true)::uuid)
    WITH CHECK (org_id = current_setting('app.org_id', true)::uuid);
END
$rls$;



-- 0) Extensões
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1) Função de trigger updated_at (idempotente)
CREATE OR REPLACE FUNCTION set_timestamp()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $func$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END
$func$;

-- 2) org_ai_settings — alinhar colunas (NÃO cria nova tabela)
--    (se já existirem, são ignoradas)
DO $ddl$
BEGIN
  IF to_regclass('public.org_ai_settings') IS NOT NULL THEN
    EXECUTE '
      ALTER TABLE public.org_ai_settings
        ADD COLUMN IF NOT EXISTS org_id uuid,
        ADD COLUMN IF NOT EXISTS ai_enabled boolean NOT NULL DEFAULT true,
        ADD COLUMN IF NOT EXISTS ai_handoff_keywords text[] DEFAULT ARRAY[''humano'',''atendente'',''pessoa''],
        ADD COLUMN IF NOT EXISTS ai_max_turns_before_handoff int DEFAULT 10,
        ADD COLUMN IF NOT EXISTS templates_enabled_channels text[] DEFAULT ARRAY[''whatsapp'',''instagram'',''facebook''],
        ADD COLUMN IF NOT EXISTS business_hours jsonb,
        ADD COLUMN IF NOT EXISTS alert_volume numeric DEFAULT 0.8,
        ADD COLUMN IF NOT EXISTS alert_sound text DEFAULT ''/assets/sounds/alert.mp3'',
        ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now(),
        ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now()
    ';

    -- Índice/único por org para permitir UPSERT por org_id
    EXECUTE 'CREATE UNIQUE INDEX IF NOT EXISTS uq_org_ai_settings_org ON public.org_ai_settings(org_id)';

    -- Trigger updated_at
    EXECUTE 'DROP TRIGGER IF EXISTS set_org_ai_settings_updated_at ON public.org_ai_settings';
    EXECUTE 'CREATE TRIGGER set_org_ai_settings_updated_at
             BEFORE UPDATE ON public.org_ai_settings
             FOR EACH ROW EXECUTE FUNCTION set_timestamp()';

    -- RLS
    EXECUTE 'ALTER TABLE public.org_ai_settings ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS org_ai_settings_isolation ON public.org_ai_settings';
    EXECUTE 'CREATE POLICY org_ai_settings_isolation ON public.org_ai_settings
              USING (org_id = current_setting(''app.org_id'', true)::uuid)
              WITH CHECK (org_id = current_setting(''app.org_id'', true)::uuid)';
  END IF;
END
$ddl$;

-- 3) Tabelas do Inbox
-- 3.1 contacts
CREATE TABLE IF NOT EXISTS public.contacts (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id uuid NOT NULL,
  provider_user_id text,            -- id do usuário no provider (IG/FB)
  name text,
  first_name text,
  cpf text,
  phone_e164 text,
  email text,
  birthdate date,
  photo_url text,
  tags text[] DEFAULT '{}',
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 3.2 conversations
CREATE TABLE IF NOT EXISTS public.conversations (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id uuid NOT NULL,
  contact_id uuid NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  channel text NOT NULL CHECK (channel IN ('whatsapp','instagram','facebook')),
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','assigned','waiting_customer','resolved')),
  assigned_to uuid,                 -- id do usuário (sem FK pra não acoplar)
  ai_enabled boolean NOT NULL DEFAULT true,
  unread_count int NOT NULL DEFAULT 0,
  last_message_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 3.3 messages
CREATE TABLE IF NOT EXISTS public.messages (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id uuid NOT NULL,
  conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  "from" text NOT NULL CHECK ("from" IN ('customer','agent','ai')),
  provider text NOT NULL CHECK (provider IN ('wa','ig','fb')),
  provider_message_id text,
  type text NOT NULL CHECK (type IN ('text','image','video','audio','file','sticker','template')),
  text text,
  emojis_json jsonb,
  attachments jsonb,                -- resumo/manifesto (opcional)
  status text CHECK (status IN ('sent','delivered','read','failed')),
  transcript text,                  -- transcrição de áudios
  meta jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 3.4 attachments (armazenamento detalhado por anexo)
CREATE TABLE IF NOT EXISTS public.attachments (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id uuid NOT NULL,
  message_id uuid REFERENCES public.messages(id) ON DELETE CASCADE,
  kind text CHECK (kind IN ('image','video','audio','file')),
  storage_key text,
  mime text,
  size_bytes bigint,
  width int,
  height int,
  duration_ms int,
  checksum text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 3.5 templates
CREATE TABLE IF NOT EXISTS public.templates (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id uuid NOT NULL,
  channel text NOT NULL CHECK (channel IN ('whatsapp','instagram','facebook')),
  name text NOT NULL,
  body text NOT NULL,
  variables text[] DEFAULT '{}',
  category text,
  status text NOT NULL DEFAULT 'approved' CHECK (status IN ('draft','approved','rejected')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 3.6 org_tags (catálogo de tags por organização)
CREATE TABLE IF NOT EXISTS public.org_tags (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id uuid NOT NULL,
  label text NOT NULL,
  color text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 4) Índices
CREATE INDEX IF NOT EXISTS idx_contacts_org ON public.contacts(org_id);
CREATE INDEX IF NOT EXISTS idx_contacts_phone ON public.contacts(phone_e164);
CREATE UNIQUE INDEX IF NOT EXISTS uq_contacts_org_cpf ON public.contacts(org_id, cpf) WHERE cpf IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_contacts_tags_gin ON public.contacts USING GIN (tags);

CREATE INDEX IF NOT EXISTS idx_conversations_org_last ON public.conversations(org_id, last_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_conversations_contact ON public.conversations(contact_id);

CREATE INDEX IF NOT EXISTS idx_messages_conv_created ON public.messages(conversation_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_org ON public.messages(org_id);
CREATE INDEX IF NOT EXISTS idx_messages_meta_gin ON public.messages USING GIN (meta);

CREATE INDEX IF NOT EXISTS idx_attachments_org ON public.attachments(org_id);
CREATE INDEX IF NOT EXISTS idx_templates_org ON public.templates(org_id);
CREATE INDEX IF NOT EXISTS idx_org_tags_org ON public.org_tags(org_id);

-- 5) Triggers updated_at
DROP TRIGGER IF EXISTS set_contacts_updated_at ON public.contacts;
CREATE TRIGGER set_contacts_updated_at
BEFORE UPDATE ON public.contacts
FOR EACH ROW EXECUTE FUNCTION set_timestamp();

DROP TRIGGER IF EXISTS set_conversations_updated_at ON public.conversations;
CREATE TRIGGER set_conversations_updated_at
BEFORE UPDATE ON public.conversations
FOR EACH ROW EXECUTE FUNCTION set_timestamp();

DROP TRIGGER IF EXISTS set_messages_updated_at ON public.messages;
CREATE TRIGGER set_messages_updated_at
BEFORE UPDATE ON public.messages
FOR EACH ROW EXECUTE FUNCTION set_timestamp();

DROP TRIGGER IF EXISTS set_attachments_updated_at ON public.attachments;
CREATE TRIGGER set_attachments_updated_at
BEFORE UPDATE ON public.attachments
FOR EACH ROW EXECUTE FUNCTION set_timestamp();

DROP TRIGGER IF EXISTS set_templates_updated_at ON public.templates;
CREATE TRIGGER set_templates_updated_at
BEFORE UPDATE ON public.templates
FOR EACH ROW EXECUTE FUNCTION set_timestamp();

DROP TRIGGER IF EXISTS set_org_tags_updated_at ON public.org_tags;
CREATE TRIGGER set_org_tags_updated_at
BEFORE UPDATE ON public.org_tags
FOR EACH ROW EXECUTE FUNCTION set_timestamp();

-- 6) RLS por organização (todas as tabelas com org_id)
ALTER TABLE public.contacts      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attachments   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.templates     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.org_tags      ENABLE ROW LEVEL SECURITY;

DO $rls$
BEGIN
  -- contacts
  DROP POLICY IF EXISTS contacts_isolation ON public.contacts;
  CREATE POLICY contacts_isolation ON public.contacts
    USING (org_id = current_setting('app.org_id', true)::uuid)
    WITH CHECK (org_id = current_setting('app.org_id', true)::uuid);

  -- conversations
  DROP POLICY IF EXISTS conversations_isolation ON public.conversations;
  CREATE POLICY conversations_isolation ON public.conversations
    USING (org_id = current_setting('app.org_id', true)::uuid)
    WITH CHECK (org_id = current_setting('app.org_id', true)::uuid);

  -- messages
  DROP POLICY IF EXISTS messages_isolation ON public.messages;
  CREATE POLICY messages_isolation ON public.messages
    USING (org_id = current_setting('app.org_id', true)::uuid)
    WITH CHECK (org_id = current_setting('app.org_id', true)::uuid);

  -- attachments
  DROP POLICY IF EXISTS attachments_isolation ON public.attachments;
  CREATE POLICY attachments_isolation ON public.attachments
    USING (org_id = current_setting('app.org_id', true)::uuid)
    WITH CHECK (org_id = current_setting('app.org_id', true)::uuid);

  -- templates
  DROP POLICY IF EXISTS templates_isolation ON public.templates;
  CREATE POLICY templates_isolation ON public.templates
    USING (org_id = current_setting('app.org_id', true)::uuid)
    WITH CHECK (org_id = current_setting('app.org_id', true)::uuid);

  -- org_tags
  DROP POLICY IF EXISTS org_tags_isolation ON public.org_tags;
  CREATE POLICY org_tags_isolation ON public.org_tags
    USING (org_id = current_setting('app.org_id', true)::uuid)
    WITH CHECK (org_id = current_setting('app.org_id', true)::uuid);
END
$rls$;

-- 7) Seeds/ajustes opcionais
-- Cria linhas padrão em org_ai_settings para cada org sem registro (se houver tabela orgs)
DO $seed$
BEGIN
  IF to_regclass('public.orgs') IS NOT NULL
     AND to_regclass('public.org_ai_settings') IS NOT NULL
  THEN
    INSERT INTO public.org_ai_settings (org_id)
    SELECT o.id
    FROM public.orgs o
    WHERE NOT EXISTS (
      SELECT 1 FROM public.org_ai_settings s WHERE s.org_id = o.id
    )
    ON CONFLICT (org_id) DO NOTHING;
  END IF;
END
$seed$;

-- ===========================
-- FIM
-- ===========================
