-- P17 calendar events table adjustments
DO $$
BEGIN
  IF to_regclass('public.calendar_events') IS NULL THEN
    CREATE TABLE public.calendar_events (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      org_id uuid NOT NULL,
      summary text,
      description text,
      start_at timestamptz NOT NULL,
      end_at timestamptz NOT NULL,
      provider text,
      external_event_id text,
      calendar_id text,
      contact_id uuid,
      reminder_sent boolean DEFAULT FALSE,
      created_at timestamptz NOT NULL DEFAULT now()
    );
  ELSE
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='calendar_events' AND column_name='external_event_id') THEN
      EXECUTE 'ALTER TABLE public.calendar_events ADD COLUMN external_event_id text';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='calendar_events' AND column_name='calendar_id') THEN
      EXECUTE 'ALTER TABLE public.calendar_events ADD COLUMN calendar_id text';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='calendar_events' AND column_name='reminder_sent') THEN
      EXECUTE 'ALTER TABLE public.calendar_events ADD COLUMN reminder_sent boolean DEFAULT FALSE';
    END IF;
  END IF;
END $$;
