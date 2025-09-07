import React, { useEffect, useState } from 'react';
import { meta } from 'api/integrations.service';

export default function InstagramCard({ data = {}, refresh }) {
  const [igBizId, setIgBizId] = useState('');
  const [pageId, setPageId] = useState('');
  const [token, setToken] = useState('');
  const [status, setStatus] = useState(data?.status || 'disconnected');

  useEffect(() => { refresh?.(); }, [refresh]);
  useEffect(() => setStatus(data?.status || 'disconnected'), [data]);

  const canConnect = !!igBizId.trim() && !!token.trim();
  const canTest = status === 'connected';

  const connect = async () => { try { await meta.ig.connect({ ig_id: igBizId, page_id: pageId, token }); await refresh?.(); } catch (e) { console.error(e);} };
  const test = async () => { try { await meta.ig.test(); } catch (e) { console.error(e);} };

  return (
    <div className="mb-6 border rounded p-4 bg-white">
      <div className="font-medium mb-2">Instagram</div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mb-3">
        <input className="border rounded px-3 py-2" placeholder="IG Business ID" value={igBizId} onChange={e=>setIgBizId(e.target.value)} />
        <input className="border rounded px-3 py-2" placeholder="Page ID (opcional)" value={pageId} onChange={e=>setPageId(e.target.value)} />
        <input className="border rounded px-3 py-2" placeholder="Access Token" value={token} onChange={e=>setToken(e.target.value)} />
      </div>
      <div className="flex items-center gap-2">
        <button className={`px-3 py-2 rounded text-white ${canConnect ? 'bg-blue-600 hover:bg-blue-700' : 'bg-gray-400'}`} disabled={!canConnect} onClick={connect}>Conectar</button>
        <button className={`px-3 py-2 rounded border ${!canTest && 'opacity-50 pointer-events-none'}`} disabled={!canTest} onClick={test}>Testar</button>
        <span className={`ml-auto text-xs px-2 py-1 rounded ${status === 'connected' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>{status}</span>
      </div>
    </div>
  );
}

