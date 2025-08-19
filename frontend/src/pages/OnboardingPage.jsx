import React, { useEffect, useState } from 'react';
import { useApi } from '../contexts/useApi';

export default function OnboardingPage() {
  const api = useApi();
  const [clientes, setClientes] = useState([]);
  const [loading, setLoading] = useState(false);

  const carregar = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/api/onboarding');
      setClientes(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Erro ao carregar clientes', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { carregar(); }, []);

  const atualizar = async (id, campo, valor) => {
    try {
      await api.put(`/api/onboarding/${id}`, { [campo]: valor });
      setClientes(prev => prev.map(c => c.id === id ? { ...c, [campo]: valor } : c));
    } catch (err) {
      console.error('Falha ao atualizar', err);
    }
  };

  const simular = (msg) => {
    // Simula ação externa (contrato, nota, acesso)
    window.alert(msg);
  };

  return (
    <div className="p-6">
      <h2 className="text-xl font-bold mb-4">Onboarding de Clientes</h2>
      <div className="overflow-x-auto">
        <table className="w-full text-sm border rounded">
          <thead className="bg-gray-200">
            <tr>
              <th className="p-2 text-left">Cliente</th>
              <th className="p-2">Contrato</th>
              <th className="p-2">Assinatura</th>
              <th className="p-2">Nota Fiscal</th>
              <th className="p-2">Treinamento</th>
              <th className="p-2">Ações</th>
            </tr>
          </thead>
          <tbody>
            {clientes.map((c) => (
              <tr key={c.id} className="border-t">
                <td className="p-2">{c.nome}</td>
                {['contrato','assinatura','nota_fiscal','treinamento'].map((campo) => (
                  <td key={campo} className="p-2 text-center">
                    <input
                      type="checkbox"
                      checked={!!c[campo]}
                      onChange={(e) => atualizar(c.id, campo, e.target.checked)}
                    />
                  </td>
                ))}
                <td className="p-2 space-x-2">
                  <button
                    onClick={() => simular(`Contrato gerado para ${c.nome}`)}
                    className="px-2 py-1 bg-gray-100 rounded"
                  >
                    Gerar Contrato
                  </button>
                  <button
                    onClick={() => simular(`Nota fiscal emitida para ${c.nome}`)}
                    className="px-2 py-1 bg-gray-100 rounded"
                  >
                    Emitir Nota
                  </button>
                  <button
                    onClick={() => simular(`Acesso enviado para ${c.nome}`)}
                    className="px-2 py-1 bg-gray-100 rounded"
                  >
                    Enviar Acesso
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {clientes.length === 0 && !loading && (
          <p className="text-sm text-gray-600 p-4">Nenhum cliente em onboarding.</p>
        )}
      </div>
    </div>
  );
}
