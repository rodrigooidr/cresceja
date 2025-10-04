import React, { useMemo } from 'react';
import {
  ResponsiveContainer, LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip, Legend,
  BarChart, Bar
} from 'recharts';

function GraphCard({ title, children, height = 280 }) {
  return (
    <section style={{ marginTop: 16 }}>
      <h2 style={{ margin: '8px 0' }}>{title}</h2>
      <div style={{ width: '100%', height, border: '1px solid #eee', borderRadius: 8, padding: 8 }}>
        <ResponsiveContainer width="100%" height="100%">
          {children}
        </ResponsiveContainer>
      </div>
    </section>
  );
}

function fmtDay(d) {
  if (!d) return '';
  const s = typeof d === 'string' ? d : String(d);
  return s.slice(0, 10); // YYYY-MM-DD
}

/**
 * props.data:
 * {
 *   wa_send_daily: [{day, transport, provider_ok, provider_fallback, total_attempts}],
 *   wa_latency_daily: [{day, transport, p50_ms, p95_ms, samples}],
 *   inbox_volume_daily: [{day, inbound_count, outbound_count, total}],
 *   inbox_ttfr_daily: [{day, ttfr_p50, ttfr_p95, samples}]
 * }
 */
export default function TelemetryCharts({ data, attendance: attendanceRaw }) {
  // MEMOs sempre no topo, sem condicionais:
  const attendance = useMemo(
    () =>
      (attendanceRaw || []).map((r) => ({
        day: fmtDay(r.day),
        pending: Number(r.pending || 0),
        confirmed: Number(r.confirmed || 0),
        canceled: Number(r.canceled || 0),
        noshow: Number(r.noshow || 0),
      })),
    [attendanceRaw],
  );

  const waSend = useMemo(
    () =>
      (data?.wa_send_daily || []).map((r) => ({
        day: fmtDay(r.day),
        transport: r.transport || 'cloud',
        ok: Number(r.provider_ok || 0),
        fb: Number(r.provider_fallback || 0),
        total: Number(r.total_attempts || 0),
      })),
    [data?.wa_send_daily],
  );

  const waLatency = useMemo(
    () =>
      (data?.wa_latency_daily || []).map((r) => ({
        day: fmtDay(r.day),
        transport: r.transport || 'cloud',
        p50: Number(r.p50_ms || r.p50 || 0),
        p95: Number(r.p95_ms || r.p95 || 0),
        samples: Number(r.samples || 0),
      })),
    [data?.wa_latency_daily],
  );

  const inboxVol = useMemo(
    () =>
      (data?.inbox_volume_daily || []).map((r) => ({
        day: fmtDay(r.day),
        inbound: Number(r.inbound_count || 0),
        outbound: Number(r.outbound_count || 0),
        total: Number(r.total || (r.inbound_count || 0) + (r.outbound_count || 0)),
      })),
    [data?.inbox_volume_daily],
  );

  const ttfr = useMemo(
    () =>
      (data?.inbox_ttfr_daily || []).map((r) => ({
        day: fmtDay(r.day),
        p50: Math.round(Number(r.ttfr_p50 ?? r.ttfr_p50_ms ?? r.ttfr_p50_s ?? 0)),
        p95: Math.round(Number(r.ttfr_p95 ?? r.ttfr_p95_ms ?? r.ttfr_p95_s ?? 0)),
        samples: Number(r.samples || 0),
      })),
    [data?.inbox_ttfr_daily],
  );

  const hasAny =
    (waSend && waSend.length) ||
    (waLatency && waLatency.length) ||
    (inboxVol && inboxVol.length) ||
    (ttfr && ttfr.length) ||
    (attendance && attendance.length);

  if (!hasAny) return null;

  return (
    <div style={{ marginTop: 8 }}>
      {waSend.length > 0 && (
        <GraphCard title="WhatsApp — Envios por dia (OK vs Fallback)">
          <BarChart data={waSend} aria-label="chart-whatsapp-sends">
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="day" />
            <YAxis allowDecimals={false} />
            <Tooltip />
            <Legend />
            <Bar dataKey="ok" name="Provider OK" stackId="a" />
            <Bar dataKey="fb" name="Fallback" stackId="a" />
          </BarChart>
        </GraphCard>
      )}

      {waLatency.length > 0 && (
        <GraphCard title="WhatsApp — Latência (ms) p50/p95">
          <LineChart data={waLatency} aria-label="chart-whatsapp-latency">
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="day" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Line type="monotone" dataKey="p50" name="p50 (ms)" dot={false} />
            <Line type="monotone" dataKey="p95" name="p95 (ms)" dot={false} />
          </LineChart>
        </GraphCard>
      )}

      {inboxVol.length > 0 && (
        <GraphCard title="Inbox — Volume por dia">
          <BarChart data={inboxVol} aria-label="chart-inbox-volume">
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="day" />
            <YAxis allowDecimals={false} />
            <Tooltip />
            <Legend />
            <Bar dataKey="inbound" name="Inbound" />
            <Bar dataKey="outbound" name="Outbound" />
          </BarChart>
        </GraphCard>
      )}

      {ttfr.length > 0 && (
        <GraphCard title="Inbox — TTFR (s) p50/p95">
          <LineChart data={ttfr} aria-label="chart-inbox-ttfr">
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="day" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Line type="monotone" dataKey="p50" name="p50 (s)" dot={false} />
            <Line type="monotone" dataKey="p95" name="p95 (s)" dot={false} />
          </LineChart>
        </GraphCard>
      )}

      {attendance.length > 0 && (
        <div aria-label="chart-attendance" style={{ height: 320, marginTop: 16 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={attendance} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="day" />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Legend />
              <Bar stackId="a" dataKey="confirmed" name="Confirmados" />
              <Bar stackId="a" dataKey="canceled" name="Cancelados" />
              <Bar stackId="a" dataKey="noshow" name="No-show" />
              <Bar stackId="a" dataKey="pending" name="Pendentes" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
