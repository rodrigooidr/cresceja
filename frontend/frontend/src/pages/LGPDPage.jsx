import inboxApi from "../../api/inboxApi";

import React, { useState } from 'react';
 

export default function LGPDPage(){
  const [leadId, setLeadId] = useState('');
  const [consent, setConsent] = useState(true);
  const [exportUrl, setExportUrl] = useState(null);

  const save = async () => {
    await inboxApi.post('/lgpd/consent', { lead_id: leadId, consent, purpose: 'atendimento' });
    alert('Consentimento atualizado');
  };
  const exportar = () => {
    const url = `/api/lgpd/export/${leadId}`;
    setExportUrl(url);
    window.open(url, '_blank');
  };
  const erase = async () => {
    await inboxApi.post('/lgpd/erase', { lead_id: leadId });
    alert('Solicitação de eliminação registrada');
  };

  return (
    <div style={{maxWidth:720, margin:'0 auto'}}>
      <h1>LGPD</h1>
      <label>ID do Lead <input value={leadId} onChange={e=>setLeadId(e.target.value)} /></label>
      <div>
        <label>
          <input type="checkbox" checked={consent} onChange={e=>setConsent(e.target.checked)} />
          Consentimento para atendimento e propostas
        </label>
      </div>
      <div style={{marginTop:8}}>
        <button onClick={save} disabled={!leadId}>Salvar consentimento</button>
        <button onClick={exportar} disabled={!leadId} style={{marginLeft:8}}>Exportar dados</button>
        <button onClick={erase} disabled={!leadId} style={{marginLeft:8}}>Solicitar eliminação</button>
      </div>
      {exportUrl && <p>Se o download não iniciar, abra: <code>{exportUrl}</code></p>}
    </div>
  );
}


