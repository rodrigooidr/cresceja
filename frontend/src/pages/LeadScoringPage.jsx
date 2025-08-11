
import React, { useState } from 'react';
import { api } from '../api/axios';
export default function LeadScoringPage(){
  const [res, setRes] = useState(null);
  const recompute = async () => {
    const r = await api.post('/leads/score/recompute');
    setRes(r.data);
  };
  return (
    <div style={{maxWidth:600, margin:'0 auto'}}>
      <h2>Lead Scoring</h2>
      <button onClick={recompute}>Recalcular pontuações</button>
      {res && <pre>{JSON.stringify(res,null,2)}</pre>}
    </div>
  );
}
