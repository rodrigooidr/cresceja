DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE c.relname='users_email_key' AND n.nspname='public') THEN
    ALTER TABLE public.users ADD CONSTRAINT users_email_key UNIQUE (email);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_conversations_status ON public.conversations (status);
CREATE INDEX IF NOT EXISTS idx_conversations_assigned_to ON public.conversations (assigned_to);
CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON public.messages (conversation_id);
CREATE INDEX IF NOT EXISTS idx_leads_created_at ON public.leads (created_at);
CREATE INDEX IF NOT EXISTS idx_posts_status ON public.posts (status);
