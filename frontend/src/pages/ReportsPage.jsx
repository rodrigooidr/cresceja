import axios from 'axios';

import React, { useEffect, useState } from 'react';
import { api } from '../api/axios';
export default function ReportsPage(){
  const [costs, setCosts] = useState(null);
  const [credits, setCredits] = useState(null);
  useEffect(()=>{
    (async()=>{
      const [c, k] = await Promise.all([ axios.get('/reports/costs'), axios.get('/reports/credits') ]);
      setCosts(c.data);
      setCredits(k.data);
    })();
  },[]);
  return (
    <div style={{maxWidth:900, margin:'0 auto'}}>
      <h2>Relatórios</h2>
      <h3>Custos estimados</h3>
      <pre>{JSON.stringify(costs, null, 2)}</pre>
      <h3>Créditos consumidos</h3>
      <pre>{JSON.stringify(credits, null, 2)}</pre>
    </div>
  );
}


