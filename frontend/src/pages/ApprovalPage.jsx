
import React, { useEffect, useState } from 'react';
import { api } from '../api/axios';

export default function ApprovalPage(){
  const [posts, setPosts] = useState([]);

  const load = async () => {
    const r = await api.get('/posts', { params: { status: 'pendente' } });
    setPosts(r.data);
  };

  useEffect(()=>{ load(); },[]);

  const approve = async (id) => {
    await api.post(`/approvals/${id}/approve`, { level: 1 });
    await api.post(`/approvals/${id}/approve`, { level: 2 });
    await load();
  };

  const reject = async (id) => {
    await api.post(`/approvals/${id}/reject`, { level: 1, comment: 'Ajustar copy' });
    await load();
  };

  return (
    <div style={{maxWidth: 900, margin:'0 auto'}}>
      <h2>Aprovação de Conteúdo</h2>
      {posts.map(p => (
        <div key={p.id} style={{border:'1px solid #ddd', padding:16, marginBottom:12}}>
          <h4>{p.title} — canal: {p.channel}</h4>
          <p>{p.content}</p>
          <button onClick={()=>approve(p.id)}>Aprovar</button>
          <button onClick={()=>reject(p.id)} style={{marginLeft:8}}>Reprovar</button>
        </div>
      ))}
      {posts.length===0 && <p>Nenhum post pendente.</p>}
    </div>
  );
}
