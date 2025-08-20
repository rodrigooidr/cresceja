import { useState } from 'react';

export default function BillingPage() {
  const [orgId, setOrgId] = useState('');
  const [planId, setPlanId] = useState('');
  const [provider, setProvider] = useState('stripe');
  const [dueDate, setDueDate] = useState('');
  const [status, setStatus] = useState(null);

  async function load() {
    if (!orgId) return;
    const r = await fetch(`/api/admin/billing/${orgId}`);
    const data = await r.json();
    setStatus(data);
  }

  async function save() {
    if (!orgId || !planId) return;
    await fetch(`/api/admin/billing/${orgId}/subscription`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ plan_id: planId, provider, due_date: dueDate }),
    });
    await load();
  }

  async function reactivate() {
    if (!orgId) return;
    await fetch(`/api/admin/billing/${orgId}/reactivate`, { method: 'POST' });
    await load();
  }

  return (
    <div className="p-4 space-y-4">
      <div className="flex gap-2">
        <input className="border p-2 flex-1" placeholder="Org ID" value={orgId} onChange={e => setOrgId(e.target.value)} />
        <button className="bg-blue-500 text-white px-4" onClick={load}>Load</button>
      </div>

      <div className="flex gap-2">
        <input className="border p-2" placeholder="Plan ID" value={planId} onChange={e => setPlanId(e.target.value)} />
        <select className="border p-2" value={provider} onChange={e => setProvider(e.target.value)}>
          <option value="stripe">Stripe</option>
          <option value="mercadopago">Mercado Pago</option>
          <option value="pagseguro">PagSeguro</option>
        </select>
        <input className="border p-2" type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} />
        <button className="bg-green-600 text-white px-4" onClick={save}>Save</button>
      </div>

      <div>
        <button className="bg-yellow-500 text-white px-4" onClick={reactivate}>Reactivate Org</button>
      </div>

      {status && (
        <div className="space-y-2">
          <pre className="bg-gray-100 p-2 text-sm overflow-auto">{JSON.stringify(status.subscription, null, 2)}</pre>
          <h3 className="font-bold">Invoices</h3>
          <pre className="bg-gray-100 p-2 text-sm overflow-auto">{JSON.stringify(status.invoices, null, 2)}</pre>
        </div>
      )}
    </div>
  );
}
