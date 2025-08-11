
import React, { useState } from 'react';
import { api } from '../api/axios';
export default function CalendarConnectPage(){
  const [urls, setUrls] = useState({});
  const getGoogleUrl = async () => {
    const r = await api.get('/calendar/google/auth');
    setUrls(u => ({...u, google: r.data.url}));
  };
  const getOutlookUrl = async () => {
    const r = await api.get('/calendar/outlook/auth');
    setUrls(u => ({...u, outlook: r.data.url}));
  };
  const createGoogle = async () => {
    await api.post('/calendar/google/event', { summary: 'Teste CresceJá', start: new Date(), end: new Date(Date.now()+3600000) });
    alert('Solicitado!');
  };
  const createOutlook = async () => {
    await api.post('/calendar/outlook/event', { subject: 'Teste CresceJá', start: new Date(), end: new Date(Date.now()+3600000) });
    alert('Solicitado!');
  };
  return (
    <div style={{maxWidth:700, margin:'0 auto'}}>
      <h2>Calendários</h2>
      <div>
        <button onClick={getGoogleUrl}>Conectar Google</button>
        {urls.google && <a href={urls.google} target="_blank" rel="noreferrer">Abrir OAuth Google</a>}
      </div>
      <div style={{marginTop:8}}>
        <button onClick={getOutlookUrl}>Conectar Outlook</button>
        {urls.outlook && <a href={urls.outlook} target="_blank" rel="noreferrer">Abrir OAuth Outlook</a>}
      </div>
      <hr/>
      <button onClick={createGoogle}>Criar evento Google (teste)</button>
      <button onClick={createOutlook} style={{marginLeft:8}}>Criar evento Outlook (teste)</button>
    </div>
  );
}
