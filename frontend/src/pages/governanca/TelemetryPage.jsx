import React, { useEffect, useState } from 'react';
import TelemetryCharts from '@/pages/governanca/TelemetryCharts';

function Table({ title, cols, rows, empty = 'Sem dados' }) {
  return (
    <section style={{ marginTop: 16 }}>
      <h2 style={{ margin: '8px 0' }}>{title}</h2>
      {!rows || rows.length === 0 ? (
        <div style={{ opacity: 0.7, padding: '8px 0' }}>{empty}</div>
      ) : (
        <div style={{ overflow: 'auto', border: '1px solid #eee', borderRadius: 8 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead style={{ background: '#fafafa' }}>
              <tr>
                {cols.map((c) => (
                  <th
                    key={c.key}
                    style={{ textAlign: 'left', padding: '8px', borderBottom: '1px solid #eee' }}
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
                    <td key={c.key} style={{ padding: '8px', borderBottom: '1px solid #f3f4f6' }}>
                      {c.render ? c.render(r[c.key], r) : String(r[c.key] ?? '')}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

export default function TelemetryPage() {
  const [range, setRange] = useState({ from: '', to: '' });
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showCharts, setShowCharts] = useState(true);
  const [appt, setAppt] = useState(null);
  const [attendance, setAttendance] = useState([]);
  const [funnel, setFunnel] = useState([]);
  const [byPersonService, setByPersonService] = useState([]);
  const hasChartData =
    !!(
      (data &&
        (data.wa_send_daily?.length ||
          data.wa_latency_daily?.length ||
          data.inbox_volume_daily?.length ||
          data.inbox_ttfr_daily?.length)) ||
      attendance?.length
    );

  useEffect(() => {
    const qp = new URLSearchParams();
    if (range.from) qp.set('from', range.from);
    if (range.to) qp.set('to', range.to);
    const queryString = qp.toString();
    setLoading(true);
    let active = true;

    async function load() {
      try {
        const overviewUrl = queryString
          ? `/api/telemetry/overview?${queryString}`
          : '/api/telemetry/overview';
        const overviewPromise = fetch(overviewUrl).then((r) => r.json());
        const urlAppt = new URL('/api/telemetry/appointments/overview', window.location.origin);
        if (range.from) urlAppt.searchParams.set('from', range.from);
        if (range.to) urlAppt.searchParams.set('to', range.to);
        const appointmentsPromise = fetch(urlAppt.toString())
          .then((r) => r.json())
          .catch(() => ({ items: [] }));

        const funnelUrl = new URL('/api/telemetry/appointments/funnel', window.location.origin);
        if (range.from) funnelUrl.searchParams.set('from', range.from);
        if (range.to) funnelUrl.searchParams.set('to', range.to);
        const funnelPromise = fetch(funnelUrl.toString())
          .then((r) => r.json())
          .catch(() => ({ items: [] }));

        const personServiceUrl = new URL(
          '/api/telemetry/appointments/by-person-service',
          window.location.origin
        );
        if (range.from) personServiceUrl.searchParams.set('from', range.from);
        if (range.to) personServiceUrl.searchParams.set('to', range.to);
        const personServicePromise = fetch(personServiceUrl.toString())
          .then((r) => r.json())
          .catch(() => ({ items: [] }));

        const [overviewData, appointmentsData, funnelData, personServiceData] = await Promise.all([
          overviewPromise,
          appointmentsPromise,
          funnelPromise,
          personServicePromise,
        ]);

        if (!active) return;
        setData(overviewData);
        setAppt(appointmentsData);
        setAttendance(appointmentsData.items || []);
        setFunnel(funnelData.items || []);
        setByPersonService(personServiceData.items || []);
      } catch (_err) {
        if (!active) return;
        setData(null);
        setAppt({ items: [] });
        setAttendance([]);
        setFunnel([]);
        setByPersonService([]);
      } finally {
        if (active) setLoading(false);
      }
    }

    load();

    return () => {
      active = false;
    };
  }, [range.from, range.to]);

  const fromParam = range.from || '';
  const toParam = range.to || '';
  const encodedFrom = encodeURIComponent(fromParam);
  const encodedTo = encodeURIComponent(toParam);

  return (
    <div style={{ padding: 16 }}>
      <h1>Métricas — Governança</h1>
      <div style={{ display: 'flex', gap: 8, margin: '8px 0', alignItems: 'center' }}>
        <label>
          De:{' '}
          <input
            type="date"
            value={range.from}
            onChange={(e) => setRange((r) => ({ ...r, from: e.target.value }))}
          />
        </label>
        <label>
          Até:{' '}
          <input
            type="date"
            value={range.to}
            onChange={(e) => setRange((r) => ({ ...r, to: e.target.value }))}
          />
        </label>
        <label style={{ marginLeft: 'auto' }}>
          <input
            type="checkbox"
            checked={showCharts}
            onChange={(e) => setShowCharts(e.target.checked)}
            style={{ marginRight: 6 }}
          />
          Mostrar gráficos
        </label>
      </div>
      {loading && <div>Carregando…</div>}
      {!loading && data && (
        <>
          {showCharts &&
            (!hasChartData ? (
              <div style={{ opacity: 0.7 }}>Sem dados para o período selecionado.</div>
            ) : (
              <TelemetryCharts data={data} attendance={attendance} />
            ))}
          {appt?.items?.length > 0 && (
            <section style={{ marginTop: 16 }}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginTop: 16,
                }}
              >
                <h2 style={{ margin: '8px 0' }}>Agenda — Comparecimento por dia</h2>
                <a
                  href={`/api/telemetry/appointments/export.csv?from=${encodedFrom}&to=${encodedTo}`}
                  style={{
                    fontSize: 14,
                    textDecoration: 'none',
                    border: '1px solid #ddd',
                    borderRadius: 6,
                    padding: '6px 10px',
                  }}
                >
                  Exportar CSV
                </a>
              </div>
              <table className="table">
                <thead>
                  <tr>
                    <th>Dia</th>
                    <th>Pend.</th>
                    <th>Confirm.</th>
                    <th>Cancel.</th>
                    <th>No-show</th>
                    <th>Lembretes</th>
                  </tr>
                </thead>
                <tbody>
                  {appt.items.map((r) => (
                    <tr key={r.day}>
                      <td>{String(r.day).slice(0, 10)}</td>
                      <td>{r.pending || 0}</td>
                      <td>{r.confirmed || 0}</td>
                      <td>{r.canceled || 0}</td>
                      <td>{r.noshow || 0}</td>
                      <td>{r.reminded || 0}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          )}
          <section style={{ marginTop: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2>Funil de Agendamentos (dia)</h2>
              <a
                href={`/api/telemetry/appointments/funnel/export.csv?from=${encodedFrom}&to=${encodedTo}`}
                className="btn"
              >
                Exportar CSV
              </a>
            </div>
            <table className="table">
              <thead>
                <tr>
                  <th>Dia</th>
                  <th>Solicitados</th>
                  <th>Confirmados</th>
                  <th>Cancelados</th>
                  <th>No-show</th>
                </tr>
              </thead>
              <tbody>
                {(funnel || []).map((r) => (
                  <tr key={r.day}>
                    <td>{String(r.day).slice(0, 10)}</td>
                    <td>{r.requested || 0}</td>
                    <td>{r.confirmed || 0}</td>
                    <td>{r.canceled || 0}</td>
                    <td>{r.noshow || 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
          <section style={{ marginTop: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2>Por Profissional / Serviço</h2>
              <a
                href={`/api/telemetry/appointments/by-person-service/export.csv?from=${encodedFrom}&to=${encodedTo}`}
                className="btn"
              >
                Exportar CSV
              </a>
            </div>
            <table className="table">
              <thead>
                <tr>
                  <th>Profissional</th>
                  <th>Serviço</th>
                  <th>Confirmados</th>
                  <th>Cancelados</th>
                  <th>No-show</th>
                </tr>
              </thead>
              <tbody>
                {(byPersonService || []).map((r, i) => (
                  <tr key={i}>
                    <td>{r.person || '-'}</td>
                    <td>{r.service || '-'}</td>
                    <td>{r.confirmed || 0}</td>
                    <td>{r.canceled || 0}</td>
                    <td>{r.noshow || 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
          <Table
            title="Envios WhatsApp por dia"
            cols={[
              { key: 'day', label: 'Dia' },
              { key: 'transport', label: 'Transporte' },
              { key: 'provider_ok', label: 'Provider OK' },
              { key: 'provider_fallback', label: 'Fallback' },
              { key: 'total_attempts', label: 'Total' },
            ]}
            rows={data.wa_send_daily?.map((r) => ({ ...r, day: String(r.day).slice(0, 10) }))}
          />
          <Table
            title="Latência (ms) — p50/p95"
            cols={[
              { key: 'day', label: 'Dia' },
              { key: 'transport', label: 'Transporte' },
              { key: 'p50_ms', label: 'p50 (ms)' },
              { key: 'p95_ms', label: 'p95 (ms)' },
              { key: 'samples', label: 'Amostras' },
            ]}
            rows={data.wa_latency_daily?.map((r) => ({ ...r, day: String(r.day).slice(0, 10) }))}
          />
          <Table
            title="Inbox — Volume por dia"
            cols={[
              { key: 'day', label: 'Dia' },
              { key: 'inbound_count', label: 'Inbound' },
              { key: 'outbound_count', label: 'Outbound' },
              { key: 'total', label: 'Total' },
            ]}
            rows={data.inbox_volume_daily?.map((r) => ({ ...r, day: String(r.day).slice(0, 10) }))}
          />
          <Table
            title="TTFR — Tempo para primeira resposta (s)"
            cols={[
              { key: 'day', label: 'Dia' },
              { key: 'ttfr_p50', label: 'p50 (s)', render: (v) => Math.round(v ?? 0) },
              { key: 'ttfr_p95', label: 'p95 (s)', render: (v) => Math.round(v ?? 0) },
              { key: 'samples', label: 'Amostras' },
            ]}
            rows={data.inbox_ttfr_daily?.map((r) => ({
              ...r,
              day: String(r.day).slice(0, 10),
              ttfr_p50: r.ttfr_p50 ?? r.ttfr_p50_ms ?? r.ttfr_p50_s,
              ttfr_p95: r.ttfr_p95 ?? r.ttfr_p95_ms ?? r.ttfr_p95_s,
            }))}
          />
        </>
      )}
    </div>
  );
}
