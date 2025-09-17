import React, { useEffect, useMemo, useState } from "react";
import { DateTime } from "luxon";
import inboxApi from "../../../api/inboxApi";
import useToastFallback from "../../../hooks/useToastFallback";

const TZ = "America/Sao_Paulo";

function toInputValue(iso) {
  if (!iso) return "";
  const dt = DateTime.fromISO(iso, { zone: TZ });
  if (!dt.isValid) return "";
  return dt.toFormat("yyyy-LL-dd'T'HH:mm");
}

function fromInputValue(value) {
  if (!value) return null;
  const dt = DateTime.fromISO(value, { zone: TZ });
  return dt.isValid ? dt.toISO() : null;
}

function makeIdempotencyKey() {
  if (typeof crypto !== "undefined" && crypto?.randomUUID) {
    return crypto.randomUUID();
  }
  return `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export default function ScheduleModal({
  open,
  onClose,
  conversation,
  client,
  onScheduled,
  addToast: addToastProp,
}) {
  const addToast = useToastFallback(addToastProp);
  const [loading, setLoading] = useState(false);
  const [suggestLoading, setSuggestLoading] = useState(false);
  const [people, setPeople] = useState([]);
  const [services, setServices] = useState([]);
  const [personName, setPersonName] = useState("");
  const [serviceName, setServiceName] = useState("");
  const [duration, setDuration] = useState(30);
  const [startValue, setStartValue] = useState(() => {
    const base = DateTime.now().setZone(TZ).plus({ hours: 1 }).startOf("hour");
    return base.toFormat("yyyy-LL-dd'T'HH:00");
  });
  const [notes, setNotes] = useState("");
  const [suggestions, setSuggestions] = useState({});

  useEffect(() => {
    if (!open) return;
    let isMounted = true;
    async function load() {
      try {
        const [calendarsRes, servicesRes] = await Promise.all([
          inboxApi.get("/calendar/calendars"),
          inboxApi.get("/calendar/services"),
        ]);
        if (!isMounted) return;
        const calendarItems = Array.isArray(calendarsRes?.data?.items)
          ? calendarsRes.data.items
          : [];
        const serviceItems = Array.isArray(servicesRes?.data?.items)
          ? servicesRes.data.items
          : [];
        setPeople(calendarItems);
        setServices(serviceItems);
        if (calendarItems.length) {
          setPersonName((prev) => prev || calendarItems[0].name || "");
        }
        if (serviceItems.length) {
          setServiceName((prev) => prev || serviceItems[0].name || "");
          if (serviceItems[0]?.durationMin) {
            setDuration(serviceItems[0].durationMin);
          }
        }
      } catch (err) {
        addToast({
          kind: "error",
          text: err?.response?.data?.message || "Falha ao carregar agendas",
        });
      }
    }
    load();
    return () => {
      isMounted = false;
    };
  }, [open, addToast]);

  useEffect(() => {
    if (!open) {
      setSuggestions({});
      return;
    }
  }, [open]);

  const aliases = useMemo(() => {
    const current = people.find((p) => p.name === personName);
    const aliasList = current?.aliases || [];
    const skillList = current?.skills || [];
    return { aliasList, skillList };
  }, [people, personName]);

  const selectedService = useMemo(
    () => services.find((svc) => svc.name === serviceName) || null,
    [services, serviceName]
  );

  useEffect(() => {
    if (!selectedService) return;
    if (selectedService?.durationMin) {
      setDuration(selectedService.durationMin);
    }
  }, [selectedService]);

  const handleSuggest = async () => {
    if (!startValue) return;
    setSuggestLoading(true);
    try {
      const fromISO = fromInputValue(startValue);
      const params = new URLSearchParams({
        personName: personName || "",
        fromISO: fromISO || "",
        durationMin: String(duration || selectedService?.durationMin || 30),
      });
      const { data } = await inboxApi.get(`/calendar/suggest?${params.toString()}`);
      setSuggestions(data?.items || {});
    } catch (err) {
      addToast({
        kind: "error",
        text: err?.response?.data?.message || "Falha ao sugerir horários",
      });
    } finally {
      setSuggestLoading(false);
    }
  };

  const handleApplySuggestion = (person, slot) => {
    if (!slot?.start) return;
    setPersonName(person);
    setStartValue(toInputValue(slot.start));
    if (slot?.end) {
      const start = DateTime.fromISO(slot.start, { zone: TZ });
      const end = DateTime.fromISO(slot.end, { zone: TZ });
      if (start.isValid && end.isValid) {
        const diff = Math.max(15, Math.round(end.diff(start, "minutes").minutes));
        setDuration(diff);
      }
    }
  };

  const handleSchedule = async () => {
    if (!personName || !startValue || !duration) {
      addToast({ kind: "error", text: "Preencha pessoa, data/hora e duração." });
      return;
    }
    const startISO = fromInputValue(startValue);
    if (!startISO) {
      addToast({ kind: "error", text: "Data/hora inválida." });
      return;
    }
    const endISO = DateTime.fromISO(startISO).plus({ minutes: Number(duration) || 30 }).toISO();
    setLoading(true);
    try {
      const payload = {
        personName,
        summary: selectedService?.name || "Atendimento",
        description: notes || undefined,
        startISO,
        endISO,
        attendeeEmail: client?.email || undefined,
        attendeeName: client?.name || client?.display_name || conversation?.client_name || undefined,
        contactId: client?.id || conversation?.client_id || undefined,
      };
      const headers = { "Idempotency-Key": makeIdempotencyKey() };
      const { data } = await inboxApi.post("/calendar/events", payload, { headers });
      addToast({ kind: "success", text: "Evento agendado com sucesso." });
      onScheduled?.({
        event: data,
        person: personName,
        service: selectedService,
      });
      onClose?.();
    } catch (err) {
      const conflict = err?.response?.data?.error === "time_conflict";
      addToast({
        kind: "error",
        text: conflict ? "Horário indisponível." : err?.response?.data?.message || err.message,
      });
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-xl rounded-2xl bg-white shadow-xl p-6 space-y-4">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-lg font-semibold">Agendar atendimento</h2>
            <p className="text-xs text-gray-500">
              {client?.name || client?.display_name || conversation?.client_name || "Cliente"}
            </p>
          </div>
          <button
            type="button"
            className="text-sm text-gray-500 hover:text-gray-700"
            onClick={() => onClose?.()}
          >
            Fechar
          </button>
        </div>

        <div className="grid grid-cols-1 gap-3">
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">Profissional</span>
            <input
              list="schedule-person-options"
              value={personName}
              onChange={(e) => setPersonName(e.target.value)}
              className="border rounded-lg px-3 py-2"
              placeholder="Nome ou apelido"
            />
            <datalist id="schedule-person-options">
              {people.map((person) => (
                <option key={person.name} value={person.name} />
              ))}
              {people.flatMap((person) =>
                (person.aliases || []).map((alias) => (
                  <option key={`${person.name}-${alias}`} value={alias} />
                ))
              )}
            </datalist>
            {aliases.aliasList.length > 0 && (
              <span className="text-xs text-gray-500">
                Apelidos: {aliases.aliasList.join(", ")}
              </span>
            )}
          </label>

          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">Serviço</span>
            <select
              value={serviceName}
              onChange={(e) => setServiceName(e.target.value)}
              className="border rounded-lg px-3 py-2"
            >
              {services.map((svc) => (
                <option key={svc.name} value={svc.name}>
                  {svc.name} ({svc.durationMin || 30} min)
                </option>
              ))}
            </select>
          </label>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium">Data e hora</span>
              <input
                type="datetime-local"
                value={startValue}
                onChange={(e) => setStartValue(e.target.value)}
                className="border rounded-lg px-3 py-2"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium">Duração (min)</span>
              <input
                type="number"
                min={15}
                step={15}
                value={duration}
                onChange={(e) => setDuration(Number(e.target.value) || 30)}
                className="border rounded-lg px-3 py-2"
              />
            </label>
          </div>

          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">Observações</span>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="border rounded-lg px-3 py-2 min-h-[96px]"
              placeholder="Informações adicionais para o evento"
            />
          </label>
        </div>

        <div className="space-y-3">
          <button
            type="button"
            className="px-4 py-2 rounded-lg border text-sm"
            onClick={handleSuggest}
            disabled={suggestLoading}
          >
            {suggestLoading ? "Buscando sugestões..." : "Sugerir horários"}
          </button>

          {Object.keys(suggestions || {}).length > 0 && (
            <div className="space-y-2">
              {Object.entries(suggestions).map(([person, slots]) => (
                <div key={person} className="space-y-1">
                  <p className="text-xs font-semibold text-gray-600">{person}</p>
                  <div className="flex flex-wrap gap-2">
                    {Array.isArray(slots) && slots.length ? (
                      slots.map((slot) => (
                        <button
                          key={`${person}-${slot.start}`}
                          type="button"
                          className="px-3 py-1 rounded-full border text-xs hover:bg-blue-50"
                          onClick={() => handleApplySuggestion(person, slot)}
                        >
                          {DateTime.fromISO(slot.start, { zone: TZ }).toFormat("dd/LL HH:mm")}
                        </button>
                      ))
                    ) : (
                      <span className="text-xs text-gray-400">Sem horários disponíveis</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 pt-2">
          <button
            type="button"
            className="px-4 py-2 rounded-lg border text-sm"
            onClick={() => onClose?.()}
            disabled={loading}
          >
            Cancelar
          </button>
          <button
            type="button"
            className={`px-4 py-2 rounded-lg text-sm text-white ${loading ? "bg-gray-400" : "bg-blue-600 hover:bg-blue-700"}`}
            onClick={handleSchedule}
            disabled={loading}
          >
            {loading ? "Agendando..." : "Agendar"}
          </button>
        </div>
      </div>
    </div>
  );
}
