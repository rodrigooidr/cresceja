import React, { useEffect, useState } from "react";
import inboxApi from "../../api/inboxApi";

export default function CalendarPage() {
  const [loading, setLoading] = useState(true);
  const [calendars, setCalendars] = useState([]);
  const [calendarId, setCalendarId] = useState("");
  const [events, setEvents] = useState([]);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      // ✅ use o endpoint padrão que já mockamos: /channels/calendar
      const res = await inboxApi.get("/channels/calendar");
      const ch = res?.data || {};
      const list = Array.isArray(ch.calendars) ? ch.calendars : [];
      if (!alive) return;
      setCalendars(list);
      // Em teste (ou no geral), selecione o primeiro para facilitar
      if (!calendarId && list[0]?.id) setCalendarId(list[0].id);
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, []); // mount only

  async function onLoadEvents() {
    if (!calendarId) return;
    // intervalo mínimo; ajuste se tiver filtro de datas
    const res = await inboxApi.get(`/channels/calendar/events?calendarId=${encodeURIComponent(calendarId)}`);
    const items = res?.data?.items || res?.data || [];
    setEvents(Array.isArray(items) ? items : []);
  }

  return (
    <section>
      <h1 data-testid="calendar-title">Calendário</h1>

      {loading && <div data-testid="calendar-skeleton">Carregando…</div>}

      {!loading && (
        <>
          <div className="flex gap-4 items-end">
            <div className="flex flex-col">
              <label htmlFor="calendarId">Calendário</label>
              <select
                id="calendarId"
                name="calendarId"
                data-testid="calendar-select"
                value={calendarId}
                onChange={(e) => setCalendarId(e.target.value)}
              >
                {calendars.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.summary}
                  </option>
                ))}
              </select>
            </div>
            <button type="button" data-testid="calendar-load" onClick={onLoadEvents}>
              Carregar eventos
            </button>
          </div>

          <ul data-testid="calendar-events" className="mt-4">
            {events.map((evt) => (
              <li key={evt.id}>{evt.title || evt.summary}</li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

