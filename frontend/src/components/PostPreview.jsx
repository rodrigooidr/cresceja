
import React, { useEffect, useState } from 'react';
import { api } from '../api/axios';
export default function PostPreview({ postId, channel='instagram' }){
  const [data, setData] = useState(null);
  useEffect(()=>{
    (async()=>{
      const r = await api.get(`/repurpose/preview/${postId}`, { params: { channel } });
      setData(r.data);
    })();
  }, [postId, channel]);
  if(!data) return <p>Carregando preview…</p>;
  return (
    <div role="region" aria-label={`Prévia para ${data.channel}`} style={{border:'1px solid #ddd', padding:12}}>
      <p><b>Canal:</b> {data.channel}</p>
      <p><b>Aspect Ratio:</b> {data.preview.aspect}</p>
      <p><b>Limite de texto:</b> {data.preview.maxText}</p>
      <p style={{whiteSpace:'pre-wrap'}}>{data.preview.content}</p>
    </div>
  );
}
