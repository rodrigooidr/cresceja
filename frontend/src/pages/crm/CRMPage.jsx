import React, { useState, useCallback } from 'react';
import inboxApi from '../../api/inboxApi';
import { useApi } from '../../contexts/useApi';
import useOrgRefetch from '../../hooks/useOrgRefetch';

const stages = ['Novo', 'Contato', 'Qualificado', 'Proposta', 'Fechado'];

function CRMPage() {
  const api = useApi();
  const [leads, setLeads] = useState([]);
  const [nome, setNome] = useState('');

  const carregarLeads = useCallback(async () => {
    try {
      const res = await inboxApi.get('/leads');
      setLeads(res.data?.items ?? res.data ?? []);
    } catch (err) {
      console.error('Erro ao carregar leads', err);
    }
  }, []);

  const criarLead = async () => {
    if (!nome.trim()) return;
    try {
      await inboxApi.post('/leads', { name: nome, stage: 'Novo' });
      setNome('');
      carregarLeads();
    } catch (err) {
      console.error('Erro ao criar lead', err);
    }
  };

  const moverLead = async (id, novoStage) => {
    try {
      await inboxApi.put(`/leads/${id}`, { stage: novoStage });
      carregarLeads();
    } catch (err) {
      console.error('Erro ao mover lead', err);
    }
  };

  useOrgRefetch(carregarLeads, [carregarLeads]);

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">Funil de Leads (CRM)</h1>

      <div className="flex gap-2 mb-4">
        <input
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          placeholder="Nome do lead"
          className="border p-2 rounded w-60"
        />
        <button onClick={criarLead} className="bg-green-600 text-white px-4 py-2 rounded">
          + Criar
        </button>
      </div>

      <div className="grid grid-cols-5 gap-4">
        {stages.map(stage => (
          <div key={stage} className="bg-gray-100 p-2 rounded shadow-sm min-h-[300px]">
            <h2 className="font-semibold text-center mb-2">{stage}</h2>
            {leads.filter(lead => lead.stage === stage).map(lead => (
              <div key={lead.id} className="bg-white p-2 rounded shadow mb-2 text-sm">
                <p>{lead.name}</p>
                <div className="flex flex-wrap gap-1 mt-2">
                  {stages
                    .filter(s => s !== stage)
                    .map(dest => (
                      <button
                        key={dest}
                        onClick={() => moverLead(lead.id, dest)}
                        className="text-xs bg-blue-100 hover:bg-blue-200 px-2 py-1 rounded"
                      >
                        Mover p/ {dest}
                      </button>
                    ))}
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export default CRMPage;

