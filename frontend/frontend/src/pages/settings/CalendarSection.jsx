import React, { useMemo, useState } from "react";
import useFeatureGate from "../../utils/useFeatureGate";
import { isNonEmpty, hasAllScopes, disabledProps } from "../../utils/readyHelpers";
import { toArray } from "../../utils/arrayish";
import { openOAuth } from "../../utils/oauthDriver";

const GCAL_READ = "https://www.googleapis.com/auth/calendar.readonly";
const GCAL_WRITE = "https://www.googleapis.com/auth/calendar.events";
const GCAL_REQUIRED_SCOPES = [GCAL_READ, GCAL_WRITE];
const DEFAULT_CAL = { connected: false, calendars: [], selectedCalendarId: "", scopes: [] };

export default function CalendarSection({ org }) {
  const { allowed } = useFeatureGate(org, "calendar", "calendar");
  if (!allowed) return null;

  const initial = useMemo(() => ({ ...DEFAULT_CAL, ...(org?.channels?.calendar || {}) }), [org]);
  const [cal, setCal] = useState(initial);

  const calendars = toArray(cal.calendars);
  const calendarId = cal?.selectedCalendarId || "";
  const permsOk = hasAllScopes(GCAL_REQUIRED_SCOPES, cal.scopes || []);
  const connected = !!cal.connected;

  const ready = connected && isNonEmpty(calendarId) && permsOk;
  const dp = disabledProps(ready,
    !connected ? "Conecte sua conta Google."
    : !calendarId ? "Selecione um calendário."
    : !permsOk ? "Autorize calendar.readonly e calendar.events."
    : ""
  );

  async function onConnect() {
    await openOAuth({
      provider: "google_calendar",
      url: "/oauth/google",
      onSuccess: (res) => {
        const nextCalendars = calendars.length ? calendars : [{ id: "primary", summary: "Agenda principal" }];
        setCal({
          connected: true,
          scopes: res.scopes || [],
          calendars: nextCalendars,
          selectedCalendarId: calendarId || nextCalendars[0]?.id || "",
        });
      },
    });
  }

  function onSelect(e) {
    setCal((s) => ({ ...s, selectedCalendarId: e.target.value }));
  }

  return (
    <section data-testid="settings-calendar-section">
      <header className="mb-2"><h3>Google Calendar</h3></header>

      <div className="flex gap-8 items-end">
        <button data-testid="gcal-connect-btn" type="button" onClick={onConnect}>
          {connected ? "Reconectar Google" : "Conectar Google"}
        </button>

        <div className="flex flex-col">
          <label className="block text-sm font-medium text-gray-700" htmlFor="calendarId">Calendário</label>
          <select
            id="calendarId"
            name="calendarId"
            data-testid="gcal-select-calendar"
            value={calendarId}
            onChange={onSelect}
          >
            {calendars.map((c) => (
              <option key={c.id} value={c.id}>{c.summary}</option>
            ))}
          </select>
        </div>

        <div className={dp.wrapperClass} aria-disabled={dp.ariaDisabled} title={dp.buttonTitle}>
          <button data-testid="gcal-test-btn" type="button" disabled={dp.buttonDisabled}>
            Testar conexão
          </button>
        </div>
      </div>
    </section>
  );
}
