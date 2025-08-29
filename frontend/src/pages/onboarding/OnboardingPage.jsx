import inboxApi from "../../api/inboxApi";
import React, { useEffect, useMemo, useState } from 'react';
import { useApi } from '../../contexts/useApi';

function ProgressBar({ percent = 0 }) {
  const p = Math.max(0, Math.min(100, Math.round(percent)));
  return (
    <div className="w-full bg-gray-200 h-2 rounded">
      <div
        className="h-2 rounded bg-blue-600 transition-all"
        style={{ width: `${p}%` }}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={p}
        role="progressbar"
      />
    </div>
  );
}

function EtapaItem({ etapa, onToggle, disabled = false }) {
  return (
    <li
      className={`bg-white p-4 rounded shadow flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 ${etapa.concluido ? 'opacity-70' : ''}`}
    >
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            className="h-4 w-4"
            checked={!!etapa.concluido}
            onChange={() => onToggle(etapa)}
            disabled={disabled}
            aria-label={`Marcar etapa "${etapa.titulo}" como ${etapa.concluido ? 'nao concluida' : 'concluida'}`}
          />
          <span className="font-medium truncate">{etapa.titulo}</span>
          {etapa.concluido && <span className="text-green-600 text-xs">Concluida</span>}
        </div>
        {etapa.descricao && <p className="text-sm text-gray-600 mt-1">{etapa.descricao}</p>}
      </div>

      <div className="flex items-center gap-2">
        {etapa.ctaHref && (
          <a
            href={etapa.ctaHref}
            target="_blank"
            rel="noreferrer"
            className="text-xs px-3 py-1 rounded bg-gray-100 hover:bg-gray-200"
          >
            {etapa.ctaLabel || 'Abrir'}
          </a>
        )}
        {!etapa.concluido && (
          <button
            onClick={() => onToggle(etapa, true)}
            className="text-xs bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700 disabled:opacity-60"
            disabled={disabled}
            type="button"
          >
            Marcar como concluida
          </button>
        )}
      </div>
    </li>
  );
}

export default function OnboardingPage() {
  const api = useApi();
  const [etapas, setEtapas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState('');

  const carregarEtapas = async () => {
    setLoading(true);
    setErro('');
    try {
      const res = await inboxApi.get('/onboarding');
      const lista = Array.isArray(res.data) ? res.data : [];
      const ordenada = [...lista].sort((a, b) => {
        if (!!a.concluido !== !!b.concluido) return a.concluido ? 1 : -1;
        const oa = a.ordem ?? a.id ?? 0;
        const ob = b.ordem ?? b.id ?? 0;
        return oa - ob;
      });
      setEtapas(ordenada);
    } catch (err) {
      console.error('Erro ao carregar onboarding', err);
      setErro('Nao foi possivel carregar as etapas. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { carregarEtapas(); }, [api]);

  const total = etapas.length;
  const concluidas = useMemo(() => etapas.filter(e => e.concluido).length, [etapas]);
  const percent = total > 0 ? (concluidas / total) * 100 : 0;

  const toggleEtapa = async (etapa, marcarConcluida = !etapa.concluido) => {
    const anterior = [...etapas];
    const atualizada = etapas.map(e => e.id === etapa.id ? { ...e, concluido: marcarConcluida } : e);
    setEtapas(atualizada);
    try {
      await inboxApi.put(`/onboarding/${etapa.id}`, { concluido: marcarConcluida });
      await carregarEtapas();
    } catch (err) {
      console.error('Erro ao atualizar etapa', err);
      setErro('Nao foi possivel atualizar a etapa. Mudancas desfeitas.');
      setEtapas(anterior);
    }
  };

  return (
    <div className="p-4 max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-3">
        <h1 className="text-2xl font-bold">Comece seu CresceJa</h1>
        <button
          type="button"
          onClick={carregarEtapas}
          className="text-sm px-3 py-2 bg-gray-100 rounded hover:bg-gray-200 disabled:opacity-60"
          disabled={loading}
        >
          Atualizar
        </button>
      </div>

      <div className="mb-4">
        <div className="flex items-center justify-between text-sm mb-2">
          <span>Progresso</span>
          <span>{concluidas}/{total} ({Math.round(percent)}%)</span>
        </div>
        <ProgressBar percent={percent} />
      </div>

      {erro && <div className="bg-red-50 text-red-700 text-sm p-3 rounded mb-4">{erro}</div>}

      {loading ? (
        <ul className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <li key={i} className="bg-white p-4 rounded shadow animate-pulse">
              <div className="h-4 bg-gray-200 rounded w-2/3 mb-2" />
              <div className="h-3 bg-gray-200 rounded w-1/2" />
            </li>
          ))}
        </ul>
      ) : etapas.length === 0 ? (
        <div className="text-sm text-gray-700">Nenhuma etapa de onboarding disponivel no momento.</div>
      ) : (
        <ul className="space-y-3" role="list" aria-label="Etapas de onboarding">
          {etapas.map(etapa => (
            <EtapaItem key={etapa.id} etapa={etapa} onToggle={toggleEtapa} disabled={loading} />
          ))}
        </ul>
      )}
    </div>
  );
}

