import useFeatureGate from "../../utils/useFeatureGate";
import { isNonEmpty, hasAllScopes, disabledProps } from "../../utils/readyHelpers";

const GCAL_READ = "https://www.googleapis.com/auth/calendar.readonly";
const GCAL_WRITE = "https://www.googleapis.com/auth/calendar.events";
const GCAL_REQUIRED_SCOPES = [GCAL_READ, GCAL_WRITE];

export default function CalendarSection({ org }) {
  const { allowed } = useFeatureGate(org, "calendar", "calendar");
  if (!allowed) return null;

  const cal = org?.channels?.calendar || {};
  const connected = !!cal.connected;
  const calendarId = cal?.selectedCalendarId || "primary";
  const scopes = cal?.scopes || [];
  const permsOk = hasAllScopes(GCAL_REQUIRED_SCOPES, scopes);

  const ready = connected && isNonEmpty(calendarId) && permsOk;

  const tip = !connected
    ? "Conecte sua conta Google."
    : !calendarId
      ? "Selecione um calendário."
      : !permsOk
        ? "Permissões insuficientes: autorize calendar.readonly e calendar.events."
        : "";

  const dp = disabledProps(ready, tip);

  return (
    <section data-testid="settings-calendar-section">
      <header className="mb-2">
        <h3>Google Calendar</h3>
      </header>

      {!permsOk && (
        <p data-testid="gcal-scopes-warning" className="text-amber-600">
          Permissões insuficientes. Requer: calendar.readonly e calendar.events.
        </p>
      )}

      <div className="flex gap-8 items-end">
        <button data-testid="gcal-connect-btn" type="button">
          {connected ? "Reconectar Google" : "Conectar Google"}
        </button>

        <select data-testid="gcal-select-calendar" defaultValue={calendarId}>
          <option value="primary">Agenda principal</option>
          {(cal?.calendars || []).map((c) => (
            <option key={c.id} value={c.id}>{c.summary}</option>
          ))}
        </select>

        <div
          className={dp.wrapperClass}
          aria-disabled={dp.ariaDisabled}
          title={dp.buttonTitle}
        >
          <button data-testid="gcal-test-btn" type="button" disabled={dp.buttonDisabled}>
            Testar conexão
          </button>
        </div>
      </div>
    </section>
  );
}
