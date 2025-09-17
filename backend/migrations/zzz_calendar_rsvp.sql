DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='calendar_events' AND column_name='rsvp_status') THEN
    ALTER TABLE public.calendar_events ADD COLUMN rsvp_status text NOT NULL DEFAULT 'pending';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='calendar_events' AND column_name='rsvp_token') THEN
    ALTER TABLE public.calendar_events ADD COLUMN rsvp_token text;
    CREATE UNIQUE INDEX IF NOT EXISTS calendar_events_rsvp_token_idx ON public.calendar_events (rsvp_token);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='calendar_events' AND column_name='reminder_sent_at') THEN
    ALTER TABLE public.calendar_events ADD COLUMN reminder_sent_at timestamptz;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='calendar_events' AND column_name='reminders_count') THEN
    ALTER TABLE public.calendar_events ADD COLUMN reminders_count integer NOT NULL DEFAULT 0;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='calendar_events' AND column_name='confirmed_at') THEN
    ALTER TABLE public.calendar_events ADD COLUMN confirmed_at timestamptz;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='calendar_events' AND column_name='canceled_at') THEN
    ALTER TABLE public.calendar_events ADD COLUMN canceled_at timestamptz;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='calendar_events' AND column_name='noshow_at') THEN
    ALTER TABLE public.calendar_events ADD COLUMN noshow_at timestamptz;
  END IF;
END $$;
