-- ensures meta_tokens exists for storing Meta OAuth tokens
CREATE TABLE IF NOT EXISTS public.meta_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid UNIQUE NOT NULL,
  token text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_meta_tokens_org ON public.meta_tokens(org_id);
