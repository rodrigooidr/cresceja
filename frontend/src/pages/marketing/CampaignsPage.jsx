import React, { useEffect, useState } from 'react';
import { useApi } from '../../contexts/useApi';

export default function CampaignsPage() {
  const api = useApi();
  const [campaigns, setCampaigns] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [lists, setLists] = useState([]);
  const [form, setForm] = useState({ name: '', template_id: '', list_id: '' });

  useEffect(() => {
    (async () => {
      try {
        const [cRes, tRes, lRes] = await Promise.all([
          api.get('/marketing/campaigns'),
          api.get('/marketing/templates'),
          api.get('/marketing/lists'),
        ]);
        setCampaigns(cRes.data.data || []);
        setTemplates(tRes.data.data || []);
        setLists(lRes.data.data || []);
      } catch (err) {
        console.error('load campaigns', err);
      }
    })();
  }, []);

  const create = async () => {
    try {
      const res = await api.post('/marketing/campaigns', form);
      setCampaigns([...campaigns, res.data.data]);
      setForm({ name: '', template_id: '', list_id: '' });
    } catch (err) {
      console.error('create campaign', err);
    }
  };

  const sendTest = async (id) => {
    const to = prompt('Enviar teste para:');
    if (!to) return;
    await api.post(`/marketing/campaigns/${id}/test`, { to });
    alert('Teste enviado');
  };

  const schedule = async (id) => {
    const sendAt = new Date(Date.now() + 2 * 60 * 1000).toISOString();
    await api.post(`/marketing/campaigns/${id}/schedule`, { sendAt });
    alert('Agendado');
  };

  return (
    <div className="p-4">
      <h1 className="text-2xl mb-4">Campanhas</h1>
      <div className="mb-4 flex flex-col gap-2 max-w-lg">
        <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Nome" className="border p-2" />
        <select value={form.template_id} onChange={(e) => setForm({ ...form, template_id: e.target.value })} className="border p-2">
          <option value="">Template</option>
          {templates.map((t) => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </select>
        <select value={form.list_id} onChange={(e) => setForm({ ...form, list_id: e.target.value })} className="border p-2">
          <option value="">Lista</option>
          {lists.map((l) => (
            <option key={l.id} value={l.id}>{l.name}</option>
          ))}
        </select>
        <button onClick={create} className="bg-blue-500 text-white px-4 py-2 rounded">Criar</button>
      </div>
      <ul className="space-y-2">
        {campaigns.map((c) => (
          <li key={c.id} className="border p-2 rounded">
            <div className="font-bold">{c.name}</div>
            <div className="text-sm">Status: {c.status}</div>
            <div className="flex gap-2 mt-2">
              <button onClick={() => sendTest(c.id)} className="px-2 py-1 bg-gray-200 rounded">Teste</button>
              <button onClick={() => schedule(c.id)} className="px-2 py-1 bg-green-500 text-white rounded">Agendar</button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
