// frontend/src/components/nav/OrgSwitcher.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useOrg } from "../../contexts/OrgContext";

const useDebounced = (value, delay = 250) => {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return v;
};

export default function OrgSwitcher() {
  const {
    orgs, selected, setSelected, loading, canSeeSelector,
    searchOrgs, loadMoreOrgs, hasMore, q: qServer
  } = useOrg();

  const active = useMemo(() => orgs.find(o => o.id === selected) || null, [orgs, selected]);
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState(qServer || "");
  const debouncedQ = useDebounced(q, 250);
  const ref = useRef(null);
  const listRef = useRef(null);
  const inputRef = useRef(null);

  // fechar ao clicar fora
  useEffect(() => {
    const onClickAway = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    window.addEventListener("mousedown", onClickAway);
    return () => window.removeEventListener("mousedown", onClickAway);
  }, []);

  // busca server-side (debounced)
  useEffect(() => {
    if (!open) return;
    searchOrgs(debouncedQ);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedQ, open]);

  // infinite scroll
  useEffect(() => {
    const el = listRef.current;
    if (!open || !el) return;
    const onScroll = async () => {
      if (!hasMore || loading) return;
      const nearBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 24;
      if (nearBottom) await loadMoreOrgs();
    };
    el.addEventListener("scroll", onScroll);
    return () => el.removeEventListener("scroll", onScroll);
  }, [open, hasMore, loading, loadMoreOrgs]);

  // focus with Ctrl+K
  useEffect(() => {
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen(true);
        setTimeout(() => inputRef.current?.focus(), 0);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  if (!canSeeSelector) {
    return <div className="px-2 text-sm text-gray-600 truncate" title={active?.name}>{active?.name || "—"}</div>;
  }

  return (
    <div className="relative" ref={ref}>
      {/* Botão mostra APENAS a org ativa */}
      <button
        type="button"
        className="w-full px-2 py-1 text-left rounded border border-gray-200 hover:bg-gray-50 truncate"
        onClick={() => setOpen(v => !v)}
        disabled={loading || orgs.length === 0}
        title={active?.name}
      >
        {active?.name || "Selecionar organização"}
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-64 rounded-md border bg-white shadow">
          <div className="p-2 border-b">
              <input
                ref={inputRef}
                className="w-full rounded border px-2 py-1 text-sm"
                placeholder="Buscar organização…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                autoFocus
            />
          </div>

          <ul ref={listRef} className="max-h-72 overflow-auto py-1">
            {orgs.map(o => (
              <li key={o.id}>
                <button
                  type="button"
                  className={`w-full text-left px-2 py-1 text-sm hover:bg-gray-50 ${
                    selected === o.id ? "bg-blue-50 font-medium" : ""
                  }`}
                  onClick={() => { setSelected(o.id); setOpen(false); }}
                  title={o.name}
                >
                  {o.name}
                </button>
              </li>
            ))}
            {loading && <li className="px-2 py-1 text-xs text-gray-500">Carregando…</li>}
            {!loading && orgs.length === 0 && (
              <li className="px-2 py-2 text-sm text-gray-500">Nenhum resultado</li>
            )}
            {!loading && hasMore && (
              <li className="px-2 py-1">
                <button
                  className="text-xs text-blue-600 hover:underline"
                  onClick={() => loadMoreOrgs()}
                >
                  Carregar mais…
                </button>
              </li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
