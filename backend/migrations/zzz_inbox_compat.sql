BEGIN;

-- 1) Colunas em messages (ADD ONLY)
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS provider_msg_id TEXT;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();

-- 2) Índices úteis
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname='public' AND indexname='msg_provider_unique')
  THEN EXECUTE 'CREATE UNIQUE INDEX msg_provider_unique ON public.messages(provider_msg_id) WHERE provider_msg_id IS NOT NULL'; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname='public' AND indexname='msg_conv_created_idx')
  THEN EXECUTE 'CREATE INDEX msg_conv_created_idx ON public.messages(conversation_id, created_at)'; END IF;
END $$;

-- 3) message_status_events compatível com tipo de messages.id
DO $$
DECLARE msg_id_sqltype text;
BEGIN
  SELECT format_type(a.atttypid, a.atttypmod)
    INTO msg_id_sqltype
  FROM pg_attribute a
  JOIN pg_class c ON c.oid=a.attrelid
  JOIN pg_namespace n ON n.oid=c.relnamespace
  WHERE n.nspname='public' AND c.relname='messages' AND a.attname='id' AND a.attnum>0;

  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='message_status_events') THEN
    EXECUTE format($f$
      CREATE TABLE public.message_status_events (
        id BIGSERIAL PRIMARY KEY,
        message_id %s REFERENCES public.messages(id) ON DELETE CASCADE,
        status TEXT NOT NULL,
        error JSONB,
        created_at TIMESTAMPTZ DEFAULT now()
      )
    $f$, msg_id_sqltype);
  ELSE
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema='public' AND table_name='message_status_events' AND column_name='message_id'
      AND format_type((SELECT a2.atttypid FROM pg_attribute a2 JOIN pg_class c2 ON c2.oid=a2.attrelid JOIN pg_namespace n2 ON n2.oid=c2.relnamespace
                       WHERE n2.nspname='public' AND c2.relname='message_status_events' AND a2.attname='message_id' AND a2.attnum>0), NULL) <> msg_id_sqltype
    ) THEN
      EXECUTE 'ALTER TABLE public.message_status_events ALTER COLUMN message_id TYPE '||msg_id_sqltype||' USING message_id::'||msg_id_sqltype;
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.table_constraints
      WHERE table_schema='public' AND table_name='message_status_events' AND constraint_type='FOREIGN KEY' AND constraint_name='message_status_events_message_id_fkey'
    ) THEN
      EXECUTE 'ALTER TABLE public.message_status_events ADD CONSTRAINT message_status_events_message_id_fkey FOREIGN KEY (message_id) REFERENCES public.messages(id) ON DELETE CASCADE';
    END IF;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname='public' AND indexname='mse_message_id_created_idx')
  THEN EXECUTE 'CREATE INDEX mse_message_id_created_idx ON public.message_status_events(message_id, created_at)'; END IF;
END $$;

-- 4) conversations: (chat_id, transport) e índices — sem mexer no que você já tem
ALTER TABLE public.conversations ADD COLUMN IF NOT EXISTS chat_id TEXT;
ALTER TABLE public.conversations ADD COLUMN IF NOT EXISTS transport TEXT;
ALTER TABLE public.conversations ADD COLUMN IF NOT EXISTS last_message_at TIMESTAMPTZ;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname='public' AND indexname='conv_chat_transport_idx')
  THEN EXECUTE 'CREATE UNIQUE INDEX conv_chat_transport_idx ON public.conversations(chat_id, transport)'; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname='public' AND indexname='conv_channel_idx')
  THEN EXECUTE 'CREATE INDEX conv_channel_idx ON public.conversations(channel)'; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname='public' AND indexname='conv_last_message_at_desc_idx')
  THEN EXECUTE 'CREATE INDEX conv_last_message_at_desc_idx ON public.conversations(last_message_at DESC)'; END IF;
END $$;

-- 5) triggers
CREATE OR REPLACE FUNCTION public.bump_conversation_last_message_at()
RETURNS trigger AS $$
BEGIN
  UPDATE public.conversations SET last_message_at = COALESCE(NEW.created_at, now()) WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='messages_after_insert_bump_last')
  THEN CREATE TRIGGER messages_after_insert_bump_last AFTER INSERT ON public.messages FOR EACH ROW EXECUTE FUNCTION public.bump_conversation_last_message_at();
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.sync_messages_status_from_event()
RETURNS trigger AS $$
BEGIN
  UPDATE public.messages SET status = NEW.status WHERE id = NEW.message_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='mse_after_insert_sync_status')
  THEN CREATE TRIGGER mse_after_insert_sync_status AFTER INSERT ON public.message_status_events FOR EACH ROW EXECUTE FUNCTION public.sync_messages_status_from_event();
  END IF;
END $$;

COMMIT;
