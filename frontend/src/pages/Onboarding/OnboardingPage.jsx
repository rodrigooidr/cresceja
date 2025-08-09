import React, { useEffect, useState } from 'react';
import { useApi } from '../../contexts/useApi';

function OnboardingPage() {
  const api = useApi();
  const [etapas, setEtapas] = useState([]);

  const carregarEtapas = async () => {
    try {
      const res = await api.get('/onboarding');
      setEtapas(res.data);
    } catch (err) {
      console.error('Erro ao carregar onboarding', err);
    }
  };

  const concluirEtapa = async (id) => {
    try {
      await api.put(`/onboarding/${id}`, { concluido: true });
      carregarEtapas();
    } catch (err) {
      console.error('Erro ao concluir etapa', err);
    }
  };

  useEffect(() => {
    carregarEtapas();
  }, []);

  return (
    <div className="p-4 max-w-xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Comece seu CresceJá 🚀</h1>
      <ul className="space-y-3">
        {etapas.map(etapa => (
          <li
            key={etapa.id}
            className={\`bg-white p-4 rounded shadow flex justify-between items-center \${etapa.concluido ? 'opacity-50' : ''}\`}
          >
            <span>{etapa.titulo}</span>
            {!etapa.concluido && (
              <button
                onClick={() => concluirEtapa(etapa.id)}
                className="text-xs bg-blue-600 text-white px-3 py-1 rounded"
              >
                Marcar como concluída
              </button>
            )}
            {etapa.concluido && (
              <span className="text-green-600 text-xs">✔️ Concluído</span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default OnboardingPage;