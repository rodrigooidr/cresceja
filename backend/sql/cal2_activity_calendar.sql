-- CAL-2: activity calendars, members and meeting events

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- helper trigger to maintain updated_at
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Calendar members ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS calendar_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL,
  calendar_id UUID NOT NULL REFERENCES calendars(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_calendar_members_org_id ON calendar_members(org_id);
CREATE INDEX IF NOT EXISTS idx_calendar_members_calendar_id ON calendar_members(calendar_id);

ALTER TABLE calendar_members ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS calendar_members_isolation ON calendar_members;
CREATE POLICY calendar_members_isolation ON calendar_members
  USING (org_id = current_setting('app.org_id')::uuid)
  WITH CHECK (org_id = current_setting('app.org_id')::uuid);

-- Extend calendar_events for meeting type ------------------------------------
ALTER TABLE calendar_events ADD COLUMN IF NOT EXISTS type TEXT NOT NULL DEFAULT 'content';
ALTER TABLE calendar_events ADD COLUMN IF NOT EXISTS title TEXT;
ALTER TABLE calendar_events ADD COLUMN IF NOT EXISTS client_name TEXT;
ALTER TABLE calendar_events ADD COLUMN IF NOT EXISTS start_at TIMESTAMPTZ;
ALTER TABLE calendar_events ADD COLUMN IF NOT EXISTS end_at TIMESTAMPTZ;
ALTER TABLE calendar_events ADD COLUMN IF NOT EXISTS attendee_id UUID;

CREATE INDEX IF NOT EXISTS idx_calendar_events_meeting
  ON calendar_events(org_id, calendar_id, start_at)
  WHERE type = 'meeting';

ALTER TABLE calendar_events ADD CONSTRAINT IF NOT EXISTS calendar_events_meeting_times
  CHECK (type <> 'meeting' OR (start_at IS NOT NULL AND end_at IS NOT NULL AND end_at > start_at));

-- Conflict validation for meeting events
CREATE OR REPLACE FUNCTION check_meeting_conflict()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.type = 'meeting' THEN
    IF EXISTS (
      SELECT 1 FROM calendar_events
      WHERE calendar_id = NEW.calendar_id
        AND type = 'meeting'
        AND tstzrange(start_at, end_at, '[)') && tstzrange(NEW.start_at, NEW.end_at, '[)')
        AND id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000')
    ) THEN
      RAISE EXCEPTION 'conflict';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_calendar_events_conflict ON calendar_events;
CREATE TRIGGER trg_calendar_events_conflict
BEFORE INSERT OR UPDATE ON calendar_events
FOR EACH ROW EXECUTE FUNCTION check_meeting_conflict();

-- maintain updated_at
DROP TRIGGER IF EXISTS trg_calendar_events_updated_at ON calendar_events;
CREATE TRIGGER trg_calendar_events_updated_at
BEFORE UPDATE ON calendar_events
FOR EACH ROW EXECUTE FUNCTION set_updated_at();
