import React, { useEffect, useState } from 'react';
import { meta } from 'api/integrations.service';

export default function FacebookCard({ orgId, currentOrg }) {
  const [status, setStatus] = useState('disconnected');
  const [pageId, setPageId] = useState('');
  const [token, setToken] = useState('');
  const [webhookOk, setWebhookOk] = useState(false);
  const [testing, setTesting] = useState(false);

  const refresh = async () => {
    try {
      const [{ data: st }, { data: wh }] = await Promise.all([
        meta.fb.status({ orgId }),
        meta.webhookCheck({ orgId })
      ]);
      setStatus(st?.status || 'disconnected');
      setWebhookOk(!!wh?.verified);
    } catch {
      setStatus('disconnected');
      setWebhookOk(false);
    }
  };

  useEffect(() => { refresh(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [orgId]);

  const connect = async () => {
    await meta.fb.connect({ orgId, page_id: pageId, access_token: token });
    await refresh();
  };
  const test = async () => {
    setTesting(true);
    try {
      await refresh();
    } finally { setTesting(false); }
  };

  return (
    <div className="border rounded-xl p-4 bg-white mt-4">
      <h3 className="font-semibold text-sm mb-2">Facebook</h3>
      <div className="flex gap-2 mt-2">
        <input placeholder="Page ID" value={pageId} onChange={e => setPageId(e.target.value)} />
        <input placeholder="Access Token" value={token} onChange={e => setToken(e.target.value)} />
        <button className="btn btn-primary" onClick={connect}>Conectar</button>
        <button className="btn" onClick={test} disabled={testing}>Testar</button>
      </div>
      <ul className="mt-2 text-sm">
        <li className="flex justify-between">Status
          <span className={`inline-flex px-2 py-0.5 rounded-md ${status==='connected'?'bg-green-600 text-white':status==='connecting'?'bg-amber-500 text-white':'bg-red-600 text-white'}`}>{status}</span>
        </li>
        <li className="flex justify-between">Webhook
          <span className={`inline-flex px-2 py-0.5 rounded-md ${webhookOk?'bg-green-600 text-white':'bg-amber-500 text-white'}`}>{webhookOk?'OK':'Pendente'}</span>
        </li>
      </ul>
    </div>
  );
}
