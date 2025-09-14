import React from "react";

export default function CalendarSection({ org }) {
  const cal = org?.channels?.calendar;
  const connected = !!cal?.token;
  const calendarId = cal?.calendarId || "primary";

  return (
    <section data-testid="settings-calendar-section">
      <header className="mb-2">
        <h3>Google Calendar</h3>
      </header>

      <div className="flex gap-8 items-end">
        <button data-testid="gcal-connect-btn" type="button">
          {connected ? "Reconectar" : "Conectar Google"}
        </button>

        <div className="flex flex-col">
          <label className="block text-sm font-medium text-gray-700" htmlFor="calendarId">
            Calendário
          </label>
          <select
            id="calendarId"
            name="calendarId"
            data-testid="gcal-select-calendar"
            defaultValue={calendarId}
          >
            <option value="primary">Agenda principal</option>
            {(cal?.calendars || []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.summary}
              </option>
            ))}
          </select>
        </div>
      </div>
    </section>
  );
}
