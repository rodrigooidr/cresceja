
import React, { useState } from 'react';
import { api } from '../api/axios';
export default function FileUploader({ onUploaded }){
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const send = async (e) => {
    e.preventDefault();
    if(!file) return;
    setLoading(true);
    const fd = new FormData();
    fd.append('file', file);
    const r = await api.post('/attachments/upload', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
    setResult(r.data);
    onUploaded && onUploaded(r.data);
    setLoading(false);
  };
  return (
    <div>
      <form onSubmit={send} aria-label="Upload de arquivo">
        <input type="file" onChange={e=>setFile(e.target.files?.[0])} aria-label="Selecionar arquivo" />
        <button disabled={!file || loading}>{loading ? 'Enviando...' : 'Enviar'}</button>
      </form>
      {result?.transcription && (
        <details style={{marginTop: 8}}>
          <summary>Transcrição</summary>
          <pre>{JSON.stringify(result.transcription, null, 2)}</pre>
        </details>
      )}
    </div>
  );
}
