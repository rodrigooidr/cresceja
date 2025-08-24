import React from 'react';

function DataCollectorPanel({ extractedData }) {
  return (
    <aside className="bg-white rounded shadow-md p-4 w-full max-w-sm">
      <h2 className="text-lg font-semibold mb-2">📋 Dados identificados</h2>
      <ul className="space-y-1">
        <li>📛 Nome: <strong>{extractedData.name || '---'}</strong></li>
        <li>📞 Telefone: <strong>{extractedData.phone || '---'}</strong></li>
        <li>📧 E-mail: <strong>{extractedData.email || '---'}</strong></li>
        <li>🏢 Empresa: <strong>{extractedData.company || '---'}</strong></li>
      </ul>
    </aside>
  );
}

export default DataCollectorPanel;