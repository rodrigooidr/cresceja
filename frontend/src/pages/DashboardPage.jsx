import axios from 'axios';
import React, { useEffect, useState } from 'react';
import { api } from '../api/axios';

export default function DashboardPage() {
  const [period, setPeriod] = useState('30');
  const [channel, setChannel] = useState('');
  const [pipeline, setPipeline] = useState([]);
  const [conversion, setConversion] = useState(null);
  const [sla, setSla] = useState(null);
  const [nps, setNps] = useState(null);

  useEffect(() => {
    async function fetchData() {
      try {
        const [p, c, a, n] = await Promise.all([
          axios.get('/reports/pipeline', { params: { channel } }),
          axios.get('/reports/conversion', { params: { channel } }),
          axios.get('/reports/atendimento', { params: { channel } }),
          axios.get(`/reports/nps?days=${period}${channel ? `&channel=${channel}` : ''}`)
        ]);
        setPipeline(p.data);
        setConversion(c.data);
        setSla(a.data);
        setNps(n.data);
      } catch (err) {
        console.error('Erro ao carregar dashboard', err);
      }
    }
    fetchData();
  }, [period, channel]);

  return (
    <div className="p-4">
      <h2 className="text-xl font-bold mb-4">Dashboard</h2>
      <div className="mb-4 flex gap-2">
        <select value={period} onChange={e => setPeriod(e.target.value)} className="border p-1">
          <option value="30">Últimos 30 dias</option>
          <option value="90">Últimos 90 dias</option>
        </select>
        <select value={channel} onChange={e => setChannel(e.target.value)} className="border p-1">
          <option value="">Todos os canais</option>
          <option value="whatsapp">WhatsApp</option>
          <option value="email">Email</option>
        </select>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="p-2 border rounded">
          <h3 className="font-semibold mb-2">Valor por fase do pipeline</h3>
          <pre className="text-sm">{JSON.stringify(pipeline, null, 2)}</pre>
        </div>
        <div className="p-2 border rounded">
          <h3 className="font-semibold mb-2">Taxa de conversão</h3>
          {conversion && (
            <ul className="text-sm">
              <li>Leads: {conversion.leads}</li>
              <li>Oportunidades: {conversion.opportunities}</li>
              <li>Ganhos: {conversion.ganhos}</li>
            </ul>
          )}
        </div>
        <div className="p-2 border rounded">
          <h3 className="font-semibold mb-2">SLA médio</h3>
          {sla && (
            <ul className="text-sm">
              <li>Assumir: {Math.round(sla.tempo_assumir || 0)}s</li>
              <li>Encerrar: {Math.round(sla.tempo_encerrar || 0)}s</li>
            </ul>
          )}
        </div>
        <div className="p-2 border rounded">
          <h3 className="font-semibold mb-2">NPS médio</h3>
          {nps && (
            <ul className="text-sm">
              <li>Média: {Number(nps.avg_score || 0).toFixed(2)}</li>
              <li>Detratores: {nps.detratores}</li>
              <li>Neutros: {nps.neutros}</li>
              <li>Promotores: {nps.promotores}</li>
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}


