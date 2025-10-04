import inboxApi from "../../api/inboxApi";

import React, { useEffect, useState } from 'react';
 
export default function SegmentsPage(){
  const [segments, setSegments] = useState([]);
  const [name, setName] = useState('Leads quentes');
  const [minScore, setMinScore] = useState(60);
  const [channel, setChannel] = useState('');
  const load = async () => {
    const r = await inboxApi.get('/crm/segments');
    setSegments(r.data);
  };
  useEffect(()=>{ load(); },[]);
  const create = async () => {
    const filter = { min_score: Number(minScore), channel: channel || undefined };
    await inboxApi.post('/crm/segments', { name, filter });
    await load();
  };
  return (
    <div style={{maxWidth:800, margin:'0 auto'}}>
      <h2>Segmentos</h2>
      <div>
        <input value={name} onChange={e=>setName(e.target.value)} placeholder="Nome do segmento" aria-label="Nome do segmento"/>
        <input type="number" value={minScore} onChange={e=>setMinScore(e.target.value)} aria-label="Pontuação mínima"/>
        <input value={channel} onChange={e=>setChannel(e.target.value)} placeholder="Canal (opcional)"/>
        <button onClick={create}>Criar segmento</button>
      </div>
      <ul>
        {segments.map(s => <li key={s.id}><b>{s.name}</b> — filtro: {JSON.stringify(s.filter)}</li>)}
      </ul>
    </div>
  );
}


