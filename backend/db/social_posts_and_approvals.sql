-- social_posts_and_approvals.sql
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Tabela mínima para suportar FKs
CREATE TABLE IF NOT EXISTS public.social_media_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL,
  title TEXT,
  content TEXT,
  created_by UUID REFERENCES public.users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- post_approvals (corrigido p/ public.users)
CREATE TABLE IF NOT EXISTS public.post_approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES public.social_media_posts(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending','approved','rejected'
  comment TEXT,
  level INTEGER NOT NULL DEFAULT 1,
  approved_by UUID REFERENCES public.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- repurposed_contents (corrigido p/ public.users)
CREATE TABLE IF NOT EXISTS public.repurposed_contents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES public.social_media_posts(id) ON DELETE CASCADE,
  type TEXT NOT NULL,     -- 'story','video','email','alt_caption'
  content TEXT NOT NULL,
  media_url TEXT,
  created_by UUID REFERENCES public.users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);
