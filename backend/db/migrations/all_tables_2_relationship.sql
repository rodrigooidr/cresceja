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