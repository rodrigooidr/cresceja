import inboxApi from "../../api/inboxApi";
import React, { useEffect, useState } from 'react';
import { useApi } from '../../contexts/useApi';

export default function AutomationsPage() {
  const api = useApi();
  const [birthday, setBirthday] = useState(null);
  const [templates, setTemplates] = useState([]);
  const [welcome, setWelcome] = useState(null);
  const [steps, setSteps] = useState([
    { delay_days: 0, template_id: '', stop_on: '' },
    { delay_days: 1, template_id: '', stop_on: '' },
    { delay_days: 7, template_id: '', stop_on: '' },
  ]);

  useEffect(() => {
    (async () => {
      try {
        const [autoRes, tplRes] = await Promise.all([
          inboxApi.get('/marketing/automations'),
          inboxApi.get('/marketing/templates'),
        ]);
        setTemplates(tplRes.data.data || []);
        const autos = autoRes.data.data || [];
        setBirthday(autos.find((a) => a.type === 'birthday') || null);
        setWelcome(autos.find((a) => a.type === 'journey') || null);
      } catch (err) {
        console.error('load automations', err);
      }
    })();
  }, []);

  const toggleBirthday = async () => {
    if (!birthday) return;
    const newStatus = birthday.status === 'on' ? 'off' : 'on';
    await inboxApi.put(`/marketing/automations/${birthday.id}/status`, { status: newStatus });
    setBirthday({ ...birthday, status: newStatus });
  };

  const saveWelcome = async () => {
    try {
      if (!welcome) {
        const res = await inboxApi.post('/marketing/automations', { name: 'Bem-vindo', type: 'journey' });
        setWelcome(res.data.data);
      } else {
        await inboxApi.put(`/marketing/automations/${welcome.id}`, { name: 'Bem-vindo' });
      }
      alert('Salvo');
    } catch (err) {
      console.error('save welcome', err);
    }
  };

  return (
    <div className="p-4 space-y-6">
      <div className="border p-4 rounded">
        <h2 className="text-xl">Automação de Aniversário</h2>
        {birthday && (
          <button onClick={toggleBirthday} className="mt-2 px-4 py-2 bg-blue-500 text-white rounded">
            {birthday.status === 'on' ? 'Desligar' : 'Ligar'}
          </button>
        )}
      </div>
      <div className="border p-4 rounded">
        <h2 className="text-xl mb-2">Journey Bem-vindo</h2>
        {steps.map((s, idx) => (
          <div key={idx} className="flex items-center gap-2 mb-2">
            <span className="w-16">T{idx === 0 ? '0' : `+${s.delay_days}`}</span>
            <select
              value={s.template_id}
              onChange={(e) => {
                const ns = [...steps];
                ns[idx].template_id = e.target.value;
                setSteps(ns);
              }}
              className="border p-1 flex-1"
            >
              <option value="">Template</option>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
            <select
              value={s.stop_on}
              onChange={(e) => {
                const ns = [...steps];
                ns[idx].stop_on = e.target.value;
                setSteps(ns);
              }}
              className="border p-1"
            >
              <option value="">continuar</option>
              <option value="open">pausa por open</option>
              <option value="click">pausa por click</option>
            </select>
          </div>
        ))}
        <button onClick={saveWelcome} className="mt-2 px-4 py-2 bg-green-500 text-white rounded">Salvar</button>
      </div>
    </div>
  );
}


