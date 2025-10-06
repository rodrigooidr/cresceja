import React, { useEffect, useMemo, useState } from "react";
import { authFetch } from "../../../services/session.js";
import { proposeSlots, createCalendarEvent } from "../../../inbox/inbox.service";
import { useOrg } from "../../../contexts/OrgContext";

/**
 * Props:
 * - open: boolean
 * - onClose: () => void
 * - contact: { id, display_name, email, phone_e164 }   // opcional, mas recomendado
 * - defaultPersonName?: string
 * - defaultServiceName?: string
 * - onScheduled?: (event) => void    // chamado após sucesso
 */
export default function ScheduleModal({
  open,
  onClose,
  contact = null,
  defaultPersonName = "",
  defaultServiceName = "",
  conversationId = null,
  onScheduled,
}) {
  const { org } = useOrg();
  const orgId = org?.id || null;
  const [loading, setLoading] = useState(false);
  const [suggesting, setSuggesting] = useState(false);
  const [error, setError] = useState("");

  // catálogo e pessoas (Google Calendar mapeado via /api/calendar/calendars)
  const [people, setPeople] = useState([]); // [{name, calendars[], aliases[], skills[], slotMin}]
  const [services, setServices] = useState([]); // [{name, durationMin, defaultSkill}]
  const [personInput, setPersonInput] = useState(defaultPersonName);
  const [serviceName, setServiceName] = useState(defaultServiceName);

  useEffect(() => {
    if (!open) return;
    setPersonInput(defaultPersonName);
    setServiceName(defaultServiceName);
  }, [open, defaultPersonName, defaultServiceName]);

  // quando serviço for escolhido, herdamos a duração
  const selectedService = useMemo(
    () => services.find((s) => s.name === serviceName) || null,
    [services, serviceName]
  );

  const [durationMin, setDurationMin] = useState(
    () => selectedService?.durationMin || 30
  );
  useEffect(() => {
    if (selectedService?.durationMin) setDurationMin(selectedService.durationMin);
  }, [selectedService]);

  // data/hora
  const todayLocal = new Date();
  const isoDateDefault = new Date(todayLocal.getTime() + 24 * 3600 * 1000) // amanhã
    .toISOString()
    .slice(0, 10); // "YYYY-MM-DD"
  const [date, setDate] = useState(isoDateDefault);
  const [time, setTime] = useState("09:00");
  const [notes, setNotes] = useState("");

  // sugestões
  const [suggestions, setSuggestions] = useState([]); // [{ start, end }]
  const suggestionLabels = ["Mais cedo", "Ideal", "Mais tarde"];
  const [pickedIndex, setPickedIndex] = useState(null);

  // mapeamento de alias -> nome
  const aliasMap = useMemo(() => {
    const map = new Map();
    for (const p of people) {
      map.set(p.name.toLowerCase(), p.name);
      (p.aliases || []).forEach((a) => map.set(String(a).toLowerCase(), p.name));
    }
    return map;
  }, [people]);

  const personResolved = useMemo(() => {
    if (!personInput) return "";
    const k = personInput.trim().toLowerCase();
    return aliasMap.get(k) || personInput; // se não reconhecer, usa literal
  }, [aliasMap, personInput]);

  // carregar catálogos
  useEffect(() => {
    if (!open) return;
    setError("");
    Promise.all([
      authFetch("/api/calendar/calendars")
        .then((r) => r.json())
        .catch(() => ({ items: [] })),
      authFetch("/api/calendar/services")
        .then((r) => r.json())
        .catch(() => ({ items: [] })),
    ]).then(([cals, serv]) => {
      setPeople(cals.items || []);
      setServices(serv.items || []);
    });
  }, [open]);

  // juntar date+time -> ISO com timezone do navegador; backend usa tz 'America/Sao_Paulo'
  function dateTimeToISO(d, t) {
    // d: "YYYY-MM-DD", t: "HH:MM"
    const local = new Date(`${d}T${t}:00`);
    return local.toISOString(); // manda em UTC; backend ajusta com TZ configurada
  }

  async function handleSuggest() {
    setError("");
    setPickedIndex(null);
    setSuggestions([]);
    const fromISO = dateTimeToISO(date, time);
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Sao_Paulo';
    setSuggesting(true);
    try {
      const data = await proposeSlots({ duration_min: durationMin || 30, count: 3, tz, start_from: fromISO });
      const slots = Array.isArray(data?.slots) ? data.slots.slice(0, 3) : [];
      setSuggestions(slots);
    } catch (e) {
      console.error('proposeSlots failed', e);
      setError("Falha ao sugerir horários.");
    } finally {
      setSuggesting(false);
    }
  }

  async function handleSubmit(e) {
    e?.preventDefault?.();
    setError("");
    setLoading(true);

    // resolve início/fim
    let startISO, endISO;
    if (pickedIndex != null && suggestions[pickedIndex]) {
      startISO = suggestions[pickedIndex].start;
      endISO = suggestions[pickedIndex].end;
    } else {
      startISO = dateTimeToISO(date, time);
      const endLocal = new Date(
        new Date(startISO).getTime() + Number(durationMin || 30) * 60000
      );
      endISO = endLocal.toISOString();
    }

    const chosenSummary = selectedService?.name || serviceName || "Atendimento";
    try {
      const attendees = [];
      const attendeeName = contact?.display_name || contact?.name || contact?.full_name || undefined;
      if (contact?.email) {
        attendees.push({ email: contact.email, name: attendeeName });
      }
      const result = await createCalendarEvent({
        org_id: orgId || undefined,
        title: chosenSummary,
        start: startISO,
        end: endISO,
        attendees,
        conversation_id: conversationId || undefined,
        notes: notes || undefined,
      });
      const eventPayload = result?.event || result || {};
      const enriched = {
        ...eventPayload,
        __serviceName: selectedService?.name || serviceName || chosenSummary || null,
        __personName: personResolved || personInput || null,
      };
      onScheduled?.(enriched);
      onClose?.();
    } catch (e2) {
      console.error('createCalendarEvent failed', e2);
      setError("Falha ao agendar.");
    } finally {
      setLoading(false);
    }
  }

  if (!open) return null;

  // UI simples e auto-contida (sem libs extras)
  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,.35)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 50,
      }}
    >
      <div
        style={{
          background: "#fff",
          width: 520,
          maxWidth: "95vw",
          borderRadius: 12,
          boxShadow: "0 10px 30px rgba(0,0,0,.2)",
        }}
      >
        <div
          style={{
            padding: "14px 16px",
            borderBottom: "1px solid #eee",
            display: "flex",
            alignItems: "center",
          }}
        >
          <strong style={{ fontSize: 16 }}>Agendar atendimento</strong>
          <button
            onClick={onClose}
            aria-label="Fechar"
            style={{
              marginLeft: "auto",
              background: "transparent",
              border: 0,
              fontSize: 18,
              cursor: "pointer",
            }}
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ padding: 16 }}>
          {/* Pessoa */}
          <label style={{ display: "block", marginBottom: 8 }}>
            Profissional (nome ou apelido)
            <input
              list="people-aliases"
              value={personInput}
              onChange={(e) => setPersonInput(e.target.value)}
              placeholder="Ex.: Rodrigo, Dr Rodrigo, Rod..."
              required
              style={{
                width: "100%",
                padding: "8px",
                marginTop: 4,
                border: "1px solid #ddd",
                borderRadius: 8,
              }}
            />
          </label>
          <datalist id="people-aliases">
            {people.map((p) => (
              <option key={`n-${p.name}`} value={p.name} />
            ))}
            {people.flatMap((p) =>
              (p.aliases || []).map((a) => (
                <option key={`a-${p.name}-${a}`} value={a} />
              ))
            )}
          </datalist>

          {/* Serviço */}
          <label style={{ display: "block", marginBottom: 8 }}>
            Serviço
            <select
              value={serviceName}
              onChange={(e) => setServiceName(e.target.value)}
              style={{
                width: "100%",
                padding: "8px",
                marginTop: 4,
                border: "1px solid #ddd",
                borderRadius: 8,
              }}
            >
              <option value="">Selecionar…</option>
              {services.map((s) => (
                <option key={s.name} value={s.name}>
                  {s.name} {s.durationMin ? `(${s.durationMin} min)` : ""}
                </option>
              ))}
            </select>
          </label>

          {/* Data e hora */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 8,
            }}
          >
            <label>
              Data
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
                style={{
                  width: "100%",
                  padding: "8px",
                  marginTop: 4,
                  border: "1px solid #ddd",
                  borderRadius: 8,
                }}
              />
            </label>
            <label>
              Hora
              <input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                required
                style={{
                  width: "100%",
                  padding: "8px",
                  marginTop: 4,
                  border: "1px solid #ddd",
                  borderRadius: 8,
                }}
              />
            </label>
          </div>

          {/* Duração */}
          <label style={{ display: "block", margin: "8px 0" }}>
            Duração (min)
            <input
              type="number"
              min="15"
              step="5"
              value={durationMin}
              onChange={(e) => setDurationMin(Number(e.target.value) || 30)}
              style={{
                width: 140,
                padding: "8px",
                marginTop: 4,
                border: "1px solid #ddd",
                borderRadius: 8,
              }}
            />
          </label>

          {/* Observações */}
          <label style={{ display: "block", marginBottom: 8 }}>
            Observações
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Informações adicionais para o evento"
              style={{
                width: "100%",
                padding: "8px",
                marginTop: 4,
                border: "1px solid #ddd",
                borderRadius: 8,
              }}
            />
          </label>

          {/* Ações de sugestão */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              marginTop: 8,
            }}
          >
            <button
              type="button"
              onClick={handleSuggest}
              disabled={suggesting}
              style={{
                background: "#0ea5e9",
                color: "#fff",
                border: 0,
                borderRadius: 8,
                padding: "8px 10px",
                cursor: "pointer",
              }}
            >
              {suggesting ? "Sugerindo…" : "Sugerir horários"}
            </button>
            {suggestions.length > 0 && (
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {suggestions.map((s, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setPickedIndex(i)}
                    style={{
                      borderRadius: 8,
                      border:
                        pickedIndex === i ? "2px solid #16a34a" : "1px solid #ddd",
                      background: pickedIndex === i ? "#dcfce7" : "#fff",
                      padding: "6px 8px",
                      cursor: "pointer",
                    }}
                    title={`${new Date(s.start).toLocaleString()} → ${new Date(s.end).toLocaleTimeString()}`}
                  >
                    <div style={{ fontSize: 12, color: '#4b5563' }}>{suggestionLabels[i] || `Opção ${i + 1}`}</div>
                    <div>{new Date(s.start).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    {"–"}
                    {new Date(s.end).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {error && (
            <div
              style={{
                marginTop: 10,
                color: "#b91c1c",
                background: "#fee2e2",
                border: "1px solid #fecaca",
                borderRadius: 8,
                padding: "8px 10px",
              }}
            >
              {error}
            </div>
          )}

          <div
            style={{
              display: "flex",
              gap: 8,
              justifyContent: "flex-end",
              marginTop: 16,
            }}
          >
            <button
              type="button"
              onClick={onClose}
              style={{
                border: "1px solid #ddd",
                background: "#fff",
                borderRadius: 8,
                padding: "8px 10px",
                cursor: "pointer",
              }}
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              style={{
                background: "#16a34a",
                color: "#fff",
                border: 0,
                borderRadius: 8,
                padding: "8px 12px",
                cursor: "pointer",
              }}
            >
              {loading ? "Agendando…" : "Agendar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
