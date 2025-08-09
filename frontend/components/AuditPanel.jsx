import React, { useEffect, useState } from 'react';

function AuditPanel() {
  const [tab, setTab] = useState('usage');
  const [data, setData] = useState([]);

  useEffect(() => {
    fetch(\`/api/audit/\${tab}\`, {
      headers: { Authorization: 'Bearer fake-jwt-token' }
    })
      .then(res => res.json())
      .then(setData);
  }, [tab]);

  return (
    <div className="bg-white p-4 border rounded space-y-4">
      <h3 className="text-lg font-bold">🔐 Painel de Governança</h3>
      <div className="space-x-4">
        <button onClick={() => setTab('usage')} className={tab === 'usage' ? 'font-bold underline' : ''}>Uso de IA</button>
        <button onClick={() => setTab('activity')} className={tab === 'activity' ? 'font-bold underline' : ''}>Atividades</button>
      </div>

      {tab === 'usage' && (
        <table className="w-full text-sm">
          <thead>
            <tr>
              <th>Serviço</th><th>Categoria</th><th>Tokens</th><th>Custo</th><th>Data</th>
            </tr>
          </thead>
          <tbody>
            {data.map((d, i) => (
              <tr key={i}>
                <td>{d.service}</td>
                <td>{d.category}</td>
                <td>{d.tokens_used}</td>
                <td>R$ {d.cost.toFixed(2)}</td>
                <td>{new Date(d.created_at).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {tab === 'activity' && (
        <table className="w-full text-sm">
          <thead>
            <tr>
              <th>Ação</th><th>Recurso</th><th>ID</th><th>Data</th>
            </tr>
          </thead>
          <tbody>
            {data.map((d, i) => (
              <tr key={i}>
                <td>{d.action}</td>
                <td>{d.resource_type}</td>
                <td>{d.resource_id}</td>
                <td>{new Date(d.created_at).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

export default AuditPanel;