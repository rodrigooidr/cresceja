import React, { useEffect, useState } from "react";
import CalendarPermissionsEditor from "@/pages/settings/CalendarPermissionsEditor";
import { authFetch } from "@/services/session.js";

function Section({ title, children }) {
  return (
    <section style={{ marginTop: 16 }}>
      <h2 style={{ margin: "4px 0 8px" }}>{title}</h2>
      <div style={{ border: "1px solid #eee", borderRadius: 8, overflow: "hidden" }}>
        {children}
      </div>
    </section>
  );
}
function Table({ cols, rows, empty = "Sem dados" }) {
  if (!rows?.length) return <div style={{ padding: 12, opacity: 0.7 }}>{empty}</div>;
  return (
    <table style={{ width: "100%", borderCollapse: "collapse" }}>
      <thead style={{ background: "#fafafa" }}>
        <tr>
          {cols.map((c) => (
            <th
              key={c.key}
              style={{ textAlign: "left", padding: 8, borderBottom: "1px solid #eee" }}
            >
              {c.label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i}>
            {cols.map((c) => (
              <td key={c.key} style={{ padding: 8, borderBottom: "1px solid #f3f4f6" }}>
                {c.render ? c.render(r[c.key], r) : String(r[c.key] ?? "")}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default function CalendarSettingsPage() {
  const [calendars, setCalendars] = useState([]);
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [svcDraft, setSvcDraft] = useState([]);

  useEffect(() => {
    Promise.all([
      authFetch("/api/calendar/calendars")
        .then((r) => r.json())
        .catch(() => ({ items: [] })),
      authFetch("/api/calendar/services")
        .then((r) => r.json())
        .catch(() => ({ items: [] })),
    ])
      .then(([cals, serv]) => {
        setCalendars(cals.items || []);
        setServices(serv.items || []);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    setSvcDraft(services);
  }, [services]);

  async function saveServices() {
    const r = await authFetch('/api/calendar/services', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items: svcDraft }),
    });
    if (!r.ok) {
      // eslint-disable-next-line no-alert
      alert('Falha ao salvar');
    } else {
      // eslint-disable-next-line no-alert
      alert('Serviços atualizados!');
    }
  }

  return (
    <div style={{ padding: 16 }}>
      <h1>Configurações — Agenda &amp; Serviços</h1>
      <p style={{ opacity: 0.8, margin: "4px 0 12px" }}>
        Lista os profissionais/calendários e o catálogo de serviços usados pela IA nos
        agendamentos.
      </p>
      {loading && <div>Carregando…</div>}
      {!loading && (
        <>
          <Section title="Profissionais (Calendários)">
            <Table
              cols={[
                { key: "name", label: "Nome" },
                {
                  key: "calendars",
                  label: "Qtd. Agendas",
                  render: (v) => (Array.isArray(v) ? v.length : 0),
                },
                {
                  key: "aliases",
                  label: "Apelidos",
                  render: (v) => (Array.isArray(v) ? v.join(", ") : ""),
                },
                {
                  key: "skills",
                  label: "Skills",
                  render: (v) => (Array.isArray(v) ? v.join(", ") : ""),
                },
                { key: "slotMin", label: "Slot Padrão (min)" },
              ]}
              rows={calendars}
            />
            <div style={{ padding: 12, fontSize: 13, opacity: 0.8 }}>
              <strong>Como editar:</strong> use <code>channel_accounts.permissions_json</code>.<br />
              Ex.: <code>{"{ \"aliases\":[\"dr rodrigo\",\"rod\"], \"skills\":[\"consulta\"], \"slotMin\":30, \"buffers\":{\"pre\":10,\"post\":10} }"}</code>
            </div>
          </Section>

          <Section title="Serviços">
            <Table
              cols={[
                { key: "name", label: "Serviço" },
                { key: "durationMin", label: "Duração (min)" },
                { key: "defaultSkill", label: "Skill Padrão" },
              ]}
              rows={services}
            />
            <div style={{ padding: 12, fontSize: 13, opacity: 0.8 }}>
              <strong>Origem:</strong> <code>org_ai_settings.collect_fields.appointment_services</code> (fallback para defaults).
            </div>
          </Section>

          <section style={{ marginTop: 24 }}>
            <h2 style={{ margin: "8px 0" }}>
              Editar profissionais (aliases, skills, slot/buffers)
            </h2>
            <div style={{ border: "1px solid #eee", borderRadius: 8, padding: 12 }}>
              <CalendarPermissionsEditor
                calendars={calendars}
                onSaved={() => {
                  authFetch('/api/calendar/calendars')
                    .then((r) => r.json())
                    .then((js) => setCalendars(js.items || []));
                }}
              />
            </div>
          </section>

          <Section title="Editar Catálogo de Serviços (OrgAdmin)">
            <div style={{ padding: 12 }}>
              {svcDraft.map((s, idx) => (
                <div
                  key={idx}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 140px 180px 80px',
                    gap: 8,
                    marginBottom: 8,
                  }}
                >
                  <input
                    value={s.name || ''}
                    onChange={(e) => {
                      const v = [...svcDraft];
                      v[idx] = { ...v[idx], name: e.target.value };
                      setSvcDraft(v);
                    }}
                    placeholder="Nome do serviço"
                  />
                  <input
                    type="number"
                    min="10"
                    step="5"
                    value={s.durationMin ?? ''}
                    onChange={(e) => {
                      const v = [...svcDraft];
                      v[idx] = { ...v[idx], durationMin: Number(e.target.value) || null };
                      setSvcDraft(v);
                    }}
                    placeholder="Duração (min)"
                  />
                  <input
                    value={s.defaultSkill || ''}
                    onChange={(e) => {
                      const v = [...svcDraft];
                      v[idx] = { ...v[idx], defaultSkill: e.target.value || null };
                      setSvcDraft(v);
                    }}
                    placeholder="Skill padrão (opcional)"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const v = [...svcDraft];
                      v.splice(idx, 1);
                      setSvcDraft(v);
                    }}
                  >
                    Remover
                  </button>
                </div>
              ))}
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  type="button"
                  onClick={() => setSvcDraft([...(svcDraft || []), { name: '', durationMin: 30, defaultSkill: '' }])}
                >
                  Adicionar serviço
                </button>
                <button
                  type="button"
                  onClick={saveServices}
                  style={{
                    background: '#16a34a',
                    color: '#fff',
                    border: 'none',
                    borderRadius: 6,
                    padding: '6px 10px',
                  }}
                >
                  Salvar
                </button>
              </div>
              <div style={{ marginTop: 8, fontSize: 12, opacity: 0.7 }}>
                Dica: a IA usa a duração/skill do serviço para sugerir horários e escolher profissionais.
              </div>
            </div>
          </Section>
        </>
      )}
    </div>
  );
}
