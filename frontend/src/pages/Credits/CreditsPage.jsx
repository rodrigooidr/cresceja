import React, { useEffect, useState } from 'react';
import { useApi } from '../../contexts/useApi';

function CreditsPage() {
  const api = useApi();
  const [dados, setDados] = useState(null);

  const carregarCreditos = async () => {
    try {
      const res = await api.get('/credits');
      setDados(res.data);
    } catch (err) {
      console.error('Erro ao carregar créditos de IA', err);
    }
  };

  useEffect(() => {
    carregarCreditos();
  }, []);

  const renderBarra = (tipo, usado, limite) => {
    const percentual = (usado / limite) * 100;
    const alerta = percentual >= 80 ? 'bg-red-500' : 'bg-blue-500';
    return (
      <div key={tipo} className="mb-4">
        <div className="flex justify-between text-sm mb-1">
          <span className="capitalize">{tipo}</span>
          <span>
            {usado} / {limite}
          </span>
        </div>
        <div className="w-full bg-gray-200 h-3 rounded">
          <div
            className={\`\${alerta} h-3 rounded transition-all\`}
            style={{ width: \`\${Math.min(percentual, 100)}%\` }}
          ></div>
        </div>
      </div>
    );
  };

  if (!dados) return <p className="p-4">Carregando créditos...</p>;

  return (
    <div className="p-4 max-w-md mx-auto">
      <h1 className="text-2xl font-bold mb-6">Créditos de IA</h1>
      {renderBarra('atendimento', dados.atendimento, dados.limites.atendimento)}
      {renderBarra('texto', dados.texto, dados.limites.texto)}
      {renderBarra('imagem', dados.imagem, dados.limites.imagem)}
      {renderBarra('vídeo', dados.video, dados.limites.video)}
    </div>
  );
}

export default CreditsPage;