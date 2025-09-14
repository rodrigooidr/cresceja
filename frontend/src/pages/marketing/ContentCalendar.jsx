import React, { useEffect, useState } from 'react';
import { useApi } from '../../contexts/useApi.js';
import useActiveOrg from '../../hooks/useActiveOrg.js';

function ContentCalendar() {
  const api = useApi();
  const { activeOrg } = useActiveOrg();
  const [campaigns, setCampaigns] = useState([]);
  const [campaignId, setCampaignId] = useState('');
  const [suggestions, setSuggestions] = useState([]);

  useEffect(() => {
    if (!activeOrg) return;
    const monthRef = new Date().toISOString().slice(0,7) + '-01';
    api.get(`/orgs/${activeOrg}/campaigns`, { params:{ month: monthRef } })
      .then(r => setCampaigns(r.data?.data || []))
      .catch(()=>setCampaigns([]));
  }, [activeOrg]);

  useEffect(() => {
    if (!activeOrg || !campaignId) return;
    api.get(`/orgs/${activeOrg}/campaigns/${campaignId}/suggestions`, { params:{ page:1, pageSize:50 } })
      .then(r => setSuggestions(r.data?.data || []))
      .catch(()=>setSuggestions([]));
  }, [activeOrg, campaignId]);

  const approve = async (id) => {
    if (!activeOrg) return;
    await api.post(`/orgs/${activeOrg}/suggestions/${id}/approve`);
    if (campaignId) {
      const r = await api.get(`/orgs/${activeOrg}/campaigns/${campaignId}/suggestions`, { params:{ page:1, pageSize:50 } });
      setSuggestions(r.data?.data || []);
    }
  };

  return (
    <div className="p-4">
      <h1 className="text-xl font-bold mb-4">Calendário de Conteúdo</h1>
      <div className="mb-4">
        <select className="border p-2" value={campaignId} onChange={e=>setCampaignId(e.target.value)}>
          <option value="">Selecione a campanha</option>
          {campaigns.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
        </select>
      </div>
      <ul className="space-y-3">
        {suggestions.map(s => {
          const copy = typeof s.copy_json === 'string' ? JSON.parse(s.copy_json) : (s.copy_json || {});
          return (
            <li key={s.id} className="border rounded p-3 flex justify-between items-center">
              <div>
                <div className="text-sm text-gray-600">{s.date} {s.time}</div>
                <div>{copy.text || ''}</div>
              </div>
              <button onClick={()=>approve(s.id)} className="bg-green-600 text-white px-3 py-1 rounded">
                Aprovar
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export default ContentCalendar;
