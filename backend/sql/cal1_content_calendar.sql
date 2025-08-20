-- CAL-1: content calendars and events for post scheduling

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- helper trigger to maintain updated_at
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Calendars table ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS calendars (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL,
  name TEXT NOT NULL,
  color TEXT,
  kind TEXT NOT NULL DEFAULT 'content',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_calendars_org_id ON calendars(org_id);

ALTER TABLE calendars ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS calendars_isolation ON calendars;
CREATE POLICY calendars_isolation ON calendars
  USING (org_id = current_setting('app.org_id')::uuid)
  WITH CHECK (org_id = current_setting('app.org_id')::uuid);

DROP TRIGGER IF EXISTS trg_calendars_updated_at ON calendars;
CREATE TRIGGER trg_calendars_updated_at
BEFORE UPDATE ON calendars
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Calendar events table ------------------------------------------------------
CREATE TABLE IF NOT EXISTS calendar_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL,
  calendar_id UUID NOT NULL REFERENCES calendars(id) ON DELETE CASCADE,
  post_id UUID REFERENCES posts(id) ON DELETE CASCADE,
  scheduled_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'scheduled',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_calendar_events_org_id ON calendar_events(org_id);
CREATE INDEX IF NOT EXISTS idx_calendar_events_calendar_id ON calendar_events(calendar_id);
CREATE INDEX IF NOT EXISTS idx_calendar_events_scheduled ON calendar_events(org_id, scheduled_at);

ALTER TABLE calendar_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS calendar_events_isolation ON calendar_events;
CREATE POLICY calendar_events_isolation ON calendar_events
  USING (org_id = current_setting('app.org_id')::uuid)
  WITH CHECK (org_id = current_setting('app.org_id')::uuid);

DROP TRIGGER IF EXISTS trg_calendar_events_updated_at ON calendar_events;
CREATE TRIGGER trg_calendar_events_updated_at
BEFORE UPDATE ON calendar_events
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Posts status ---------------------------------------------------------------
ALTER TABLE posts ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'draft';
