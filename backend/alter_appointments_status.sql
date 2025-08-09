-- sql/alter_appointments_status.sql
CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'scheduled';

-- Índice para busca por WhatsApp (só dígitos)
CREATE INDEX IF NOT EXISTS idx_appointments_contact
  ON public.appointments ((regexp_replace(contact_whatsapp, '[^0-9]+', '', 'g')));