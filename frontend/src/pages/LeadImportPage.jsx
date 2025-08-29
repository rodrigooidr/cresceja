import inboxApi from "../../api/inboxApi";

import React, { useState } from 'react';
 
export default function LeadImportPage(){
  const [file, setFile] = useState(null);
  const [result, setResult] = useState(null);
  const submit = async (e) => {
    e.preventDefault();
    const fd = new FormData();
    fd.append('file', file);
    const r = await inboxApi.post('/leads/import-csv', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
    setResult(r.data);
  };
  return (
    <main id="content" style={{maxWidth:600, margin:'0 auto'}}>
      <h1>Importar Leads (CSV)</h1>
      <form onSubmit={submit} aria-describedby="csv-help">
        <input type="file" accept=".csv" onChange={e=>setFile(e.target.files?.[0])} required aria-label="Arquivo CSV" />
        <p id="csv-help">Colunas suportadas: name/nome, email, phone/telefone</p>
        <button type="submit" disabled={!file}>Importar</button>
      </form>
      {result && <pre aria-live="polite" style={{marginTop:12}}>{JSON.stringify(result,null,2)}</pre>}
    </main>
  );
}


