import inboxApi from "../../api/inboxApi";
import React, { useEffect, useState } from 'react';
import { useApi } from '../../contexts/useApi';
import { useOrg } from '../../contexts/OrgContext';

export default function TemplatesPage() {
  const api = useApi();
  const [templates, setTemplates] = useState([]);
  const [form, setForm] = useState({ name: '', subject: '', body: '' });
  const { selected: orgId, orgChangeTick } = useOrg();

  useEffect(() => {
    if (!orgId) return;
    (async () => {
      try {
        const res = await inboxApi.get('/marketing/templates');
        setTemplates(res.data.data || []);
      } catch (err) {
        console.error('load templates', err);
      }
    })();
  }, [orgId, orgChangeTick]);

  const create = async () => {
    try {
      const res = await inboxApi.post('/marketing/templates', form);
      setTemplates([...templates, res.data.data]);
      setForm({ name: '', subject: '', body: '' });
    } catch (err) {
      console.error('create template', err);
    }
  };

  return (
    <div className="p-4">
      <h1 className="text-2xl mb-4">Templates</h1>
      <div className="mb-4 flex flex-col gap-2 max-w-lg">
        <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Nome" className="border p-2" />
        <input value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} placeholder="Assunto" className="border p-2" />
        <textarea value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} placeholder="HTML" className="border p-2" />
        <button onClick={create} className="bg-blue-500 text-white px-4 py-2 rounded">Salvar</button>
      </div>
      <ul className="list-disc pl-5">
        {templates.map((t) => (
          <li key={t.id}>{t.name} - {t.subject}</li>
        ))}
      </ul>
    </div>
  );
}


