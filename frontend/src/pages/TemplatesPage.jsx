import axios from 'axios';

import React, { useEffect, useState } from 'react';
import { api } from '../api/axios';

export default function TemplatesPage(){
  const [items, setItems] = useState([]);
  const [form, setForm] = useState({ name:'boas_vindas', category:'MARKETING', language:'pt_BR', body:'Olá {{nome}}, podemos te ajudar?' });

  const load = async () => {
    const r = await axios.get('/whatsapp/templates');
    setItems(r.data);
  };
  useEffect(()=>{ load(); },[]);

  const create = async () => {
    await axios.post('/whatsapp/templates', form);
    await load();
  };
  const setStatus = async (id, status) => {
    await axios.patch(`/whatsapp/templates/${id}/status`, { status });
    await load();
  };

  return (
    <div style={{maxWidth:900, margin:'0 auto'}}>
      <h1>Templates WhatsApp</h1>
      <div>
        <input placeholder="name" value={form.name} onChange={e=>setForm({...form, name:e.target.value})} />
        <select value={form.category} onChange={e=>setForm({...form, category:e.target.value})}>
          <option>MARKETING</option><option>UTILITY</option><option>AUTHENTICATION</option>
        </select>
        <input placeholder="language" value={form.language} onChange={e=>setForm({...form, language:e.target.value})} />
        <textarea placeholder="body" value={form.body} onChange={e=>setForm({...form, body:e.target.value})}></textarea>
        <button onClick={create}>Criar</button>
      </div>
      <ul>
        {items.map(t=>(
          <li key={t.id}>
            <b>{t.name}</b> — {t.status} — {t.language}
            <pre>{t.body}</pre>
            <button onClick={()=>setStatus(t.id,'submitted')}>Marcar como enviado p/ aprovação</button>
            <button onClick={()=>setStatus(t.id,'approved')} style={{marginLeft:8}}>Aprovar</button>
          </li>
        ))}
      </ul>
    </div>
  );
}


