import React, { useEffect, useState } from 'react';
import { meta } from 'api/integrations.service';

export default function FacebookCard({ data = {}, refresh }) {
  const [pageId, setPageId] = useState('');
  const [status, setStatus] = useState(data?.status || 'disconnected');

  useEffect(() => { refresh?.(); }, [refresh]);
  useEffect(() => setStatus(data?.status || 'disconnected'), [data]);

  const canConnect = !!pageId.trim();
  const canTest = status === 'connected';

  const connect = async () => { try { await meta.fb.connect({ page_id: pageId }); await refresh?.(); } catch (e) { console.error(e);} };
  const test = async () => { try { await meta.fb.test(); } catch (e) { console.error(e);} };

  return (
    <div className="mb-6 border rounded p-4 bg-white">
      <div className="font-medium mb-2">Facebook</div>
      <div className="mb-3">
        <input className="border rounded px-3 py-2" placeholder="Page ID" value={pageId} onChange={e=>setPageId(e.target.value)} />
      </div>
      <div className="flex items-center gap-2">
        <button className={`px-3 py-2 rounded text-white ${canConnect ? 'bg-blue-600 hover:bg-blue-700' : 'bg-gray-400'}`} disabled={!canConnect} onClick={connect}>Conectar</button>
        <button className={`px-3 py-2 rounded border ${!canTest && 'opacity-50 pointer-events-none'}`} disabled={!canTest} onClick={test}>Testar</button>
        <span className={`ml-auto text-xs px-2 py-1 rounded ${status === 'connected' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>{status}</span>
      </div>
    </div>
  );
}

