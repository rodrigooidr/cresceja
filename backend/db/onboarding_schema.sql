ALTER TABLE companies ADD COLUMN segment TEXT;

CREATE TABLE onboarding_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id),
  user_id UUID REFERENCES auth.users(id),
  step TEXT NOT NULL,
  completed_at TIMESTAMP DEFAULT now()
);