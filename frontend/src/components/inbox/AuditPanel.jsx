import { useEffect, useState, useRef } from 'react';
import auditlog, { downloadCSVForConversation } from '../../inbox/auditlog.js';

export default function AuditPanel({ conversationId, onClose }) {
  const [items, setItems] = useState([]);
  const [query, setQuery] = useState('');
  const [kinds, setKinds] = useState([]);
  const openerRef = useRef(null);

  useEffect(() => {
    openerRef.current = document.activeElement;
    return () => {
      try { openerRef.current && openerRef.current.focus(); } catch {}
    };
  }, []);

  useEffect(() => {
    setItems(auditlog.load(conversationId) || []);
  }, [conversationId]);

  const toggleKind = (k) => {
    setKinds((s) => (s.includes(k) ? s.filter((x) => x !== k) : [...s, k]));
  };

  const filtered = items.filter((e) => {
    if (kinds.length && !kinds.includes(e.kind)) return false;
    if (query) {
      const blob = `${e.kind} ${e.action} ${JSON.stringify(e.meta || {})}`.toLowerCase();
      if (!blob.includes(query.toLowerCase())) return false;
    }
    return true;
  });
  const groups = groupByDate(filtered);

  const handleExport = () => {
    const json = auditlog.exportJson(conversationId);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit-${conversationId}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const handleClear = () => {
    if (!conversationId) return;
    if (window.confirm('Limpar histórico?')) {
      auditlog.clear(conversationId);
      setItems([]);
    }
  };

  return (
    <div className="h-full flex flex-col" data-testid="audit-panel">
      <div className="mb-2 flex items-center gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar"
          aria-label="Buscar"
          className="border p-1 rounded flex-1"
          data-testid="audit-search"
        />
        {onClose && (
          <button onClick={onClose} aria-label="Fechar">×</button>
        )}
      </div>
      <div className="flex flex-wrap gap-2 mb-2 text-xs">
        {auditlog.listTypes().map((k) => (
          <label key={k} className="flex items-center gap-1">
            <input
              type="checkbox"
              checked={kinds.includes(k)}
              onChange={() => toggleKind(k)}
              data-testid={`audit-filter-${k}`}
            />
            {k}
          </label>
        ))}
      </div>
      <div className="flex-1 overflow-y-auto">
        <ul data-testid="audit-list" className="space-y-4">
          {groups.map((g) => (
            <li key={g.label}>
              <div className="text-xs font-semibold mb-1">{g.label}</div>
              <ul className="pl-2 space-y-1">
                {g.items.map((e) => (
                  <li key={e.id} data-testid="audit-item" className="text-xs">
                    <span className="font-medium">{e.kind}</span> {e.action}
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      </div>
      <div className="mt-2 flex gap-2">
        <button
          onClick={handleExport}
          data-testid="audit-export"
          aria-label="Exportar JSON"
          className="px-2 py-1 border rounded"
        >
          Exportar JSON
        </button>
        <button
          onClick={() => downloadCSVForConversation(conversationId, auditlog.load(conversationId) || [])}
          data-testid="audit-export-csv"
          aria-label="Exportar CSV"
          className="px-2 py-1 text-sm border rounded"
        >
          Exportar CSV
        </button>
        <button
          onClick={handleClear}
          data-testid="audit-clear"
          aria-label="Limpar"
          className="px-2 py-1 border rounded"
        >
          Limpar
        </button>
      </div>
    </div>
  );
}

function groupByDate(entries = []) {
  const groups = {};
  const todayStr = new Date().toDateString();
  const yesterdayStr = new Date(Date.now() - 86400000).toDateString();
  entries.forEach((e) => {
    const key = new Date(e.ts).toDateString();
    groups[key] = groups[key] || [];
    groups[key].push(e);
  });
  return Object.entries(groups)
    .sort((a, b) => new Date(b[0]) - new Date(a[0]))
    .map(([k, items]) => ({
      label:
        k === todayStr
          ? 'Hoje'
          : k === yesterdayStr
          ? 'Ontem'
          : new Date(k).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }),
      items,
    }));
}
