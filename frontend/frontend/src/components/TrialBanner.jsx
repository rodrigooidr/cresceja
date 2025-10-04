import inboxApi from "../../api/inboxApi";
import React from 'react';
import { useEffect, useState } from 'react';


export default function TrialBanner(){
  const [sub, setSub] = useState(null);
  useEffect(()=>{
    (async()=>{
      try{
        const r = await inboxApi.get('/subscription/status');
        setSub(r.data);
      }catch{}
    })();
  },[]);

  if(!sub || sub.status === 'no_subscription' || sub.trial_days_left <= 0) return null;
  return (
    <div style={{background:'#fff3cd', border:'1px solid #ffeeba', padding:12, margin:'12px 0'}}>
      Seu teste grátis termina em <b>{sub.trial_days_left}</b> dia(s). Assine o plano Pro+ e não perca o acesso.
    </div>
  );
}


