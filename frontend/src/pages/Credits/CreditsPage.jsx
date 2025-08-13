import React, { useEffect, useState, useMemo } from 'react';
import { useApi } from '../../contexts/useApi';

function clamp(n, min, max) { return Math.min(Math.max(n, min), max); }
function classPorUso(percentual) {
  if (percentual >= 80) return 'bg-red-500';
  if (percentual >= 60) return 'bg-amber-500';
  return 'bg-blue-500';
}

function BarraCredito({ tipo, usado = 0, limite = 0 }) {
  const pct = limite > 0 ? (usado / limite) * 100 : 0;
  const pctClamped = clamp(pct, 0, 100);
  const cor = classPorUso(pctClamped);
  const restante = Math.max(limite - usado, 0);

  return (
    <div className="mb-4">
      <div className="flex justify-between text-sm mb-1">
        <span className="capitalize">{tipo}</span>
        <span title={`${pctClamped.toFixed(0)}%`}>
          {usado} / {limite} ({pctClamped.toFixed(0)}%)
        </span>
      </div>
      <div className="w-full bg-gray-200 h-3 rounded" role="progressbar" aria-valuemin={0} aria-valuemax={limite || 0} aria-valuenow={Math.min(usado, limite || usado)} aria-label={`Uso de creditos de ${tipo}`}>
        <div className={`${cor} h-3 rounded transition-all`} style={{ width: `${pctClamped}%` }} />
      </div>
      <div className="text-xs text-gray-600 mt-1">Restante: <strong>{restante}</strong></div>
    </div>
  );
}

export default function CreditsPage() {
  const api = useApi();
  const [dados, setDados] = useState(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState(null);

  const carregarCreditos = async () => {
    setLoading(true); setErro(null);
    try {
      const res = await api.get('/credits');
      setDados(res.data || null);
    } catch (err) {
      console.error('Erro ao carregar creditos de IA', err);
      setErro('Nao foi possivel carregar os creditos. Tente novamente.');
      setDados(null);
    } finally { setLoading(false); }
  };

  useEffect(() => { carregarCreditos(); }, [api]);
  const limites = useMemo(() => dados?.limites || {}, [dados]);

  if (loading) return <p className="p-4">Carregando creditos...</p>;

  if (erro) {
    return (
      <div className="p-4 max-w-md mx-auto">
        <h1 className="text-2xl font-bold mb-4">Creditos de IA</h1>
        <div className="bg-red-50 text-red-700 text-sm p-3 rounded mb-4">{erro}</div>
        <button type="button" onClick={carregarCreditos} className="text-sm px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
          Tentar novamente
        </button>
      </div>
    );
  }

  if (!dados) {
    return (
      <div className="p-4 max-w-md mx-auto">
        <h1 className="text-2xl font-bold mb-6">Creditos de IA</h1>
        <p className="text-sm text-gray-700">Nenhuma informacao de creditos disponivel.</p>
      </div>
    );
  }

  return (
    <div className="p-4 max-w-md mx-auto">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">Creditos de IA</h1>
        <button type="button" onClick={carregarCreditos} className="text-sm px-3 py-2 bg-gray-100 rounded hover:bg-gray-200">
          Atualizar
        </button>
      </div>

      <BarraCredito tipo="atendimento" usado={dados.atendimento} limite={limites.atendimento} />
      <BarraCredito tipo="texto" usado={dados.texto} limite={limites.texto} />
      <BarraCredito tipo="imagem" usado={dados.imagem} limite={limites.imagem} />
      <BarraCredito tipo="video" usado={dados.video} limite={limites.video} />
    </div>
  );
}