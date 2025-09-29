BEGIN;

CREATE TABLE IF NOT EXISTS public.plan_credits (
  plan_id uuid PRIMARY KEY
    REFERENCES public.plans(id) ON UPDATE CASCADE ON DELETE CASCADE,
  ai_attendance_monthly int NOT NULL DEFAULT 0, -- atendimento via IA
  ai_content_monthly    int NOT NULL DEFAULT 0, -- criação de conteúdo
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Seed para todos os planos já existentes, sem sobrescrever
INSERT INTO public.plan_credits (plan_id)
SELECT p.id
FROM public.plans p
LEFT JOIN public.plan_credits c ON c.plan_id = p.id
WHERE c.plan_id IS NULL;

COMMIT;
