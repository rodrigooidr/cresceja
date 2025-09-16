import { useCallback, useEffect, useRef, useState } from "react";

function resolvePersistenceKey(getKey) {
  if (typeof getKey === "function") {
    try {
      const value = getKey();
      if (typeof value === "string" && value) return value;
      if (value != null) return String(value);
    } catch {
      return "default";
    }
  } else if (typeof getKey === "string" && getKey) {
    return getKey;
  }
  return "default";
}

/**
 * Controle de seleção com:
 * - toggle individual
 * - shift-click (faixa)
 * - selecionar tudo visível
 * - limpar
 * - persistência por chave (ex.: filtro atual)
 *
 * items: array de { id, suggestionId }
 * getKey: função que retorna chave de persistência (ex.: "month:2025-09", "filter:pendentes")
 */
export default function useListSelection({ items = [], getKey } = {}) {
  const persistenceKey = resolvePersistenceKey(getKey);
  const [selectedMap, setSelectedMap] = useState(() => new Map());
  const lastIndexRef = useRef(null);
  const keyRef = useRef(persistenceKey);

  // Persistência por chave (opcional)
  useEffect(() => {
    const key = persistenceKey;
    keyRef.current = key;
    try {
      const raw = typeof localStorage !== "undefined" ? localStorage.getItem(`cc:sel:${key}`) : null;
      if (raw) {
        const arr = JSON.parse(raw);
        setSelectedMap(new Map(arr));
      } else {
        setSelectedMap(new Map());
      }
    } catch {
      /* noop */
    }
  }, [persistenceKey]);

  useEffect(() => {
    try {
      const key = keyRef.current;
      const arr = Array.from(selectedMap.entries());
      if (typeof localStorage !== "undefined") {
        localStorage.setItem(`cc:sel:${key}`, JSON.stringify(arr));
      }
    } catch {
      /* noop */
    }
  }, [selectedMap]);

  const indexOf = useCallback((jobId) => items.findIndex((x) => x.id === jobId), [items]);

  const isSelected = useCallback((jobId) => selectedMap.has(jobId), [selectedMap]);

  const toggle = useCallback(
    (jobId, suggestionId, { shiftKey = false } = {}) => {
      const idx = indexOf(jobId);
      if (idx === -1) return;

      const lastIndex = lastIndexRef.current;

      setSelectedMap((prev) => {
        const next = new Map(prev);
        if (shiftKey && lastIndex != null) {
          // Seleção por faixa
          const start = Math.min(lastIndex, idx);
          const end = Math.max(lastIndex, idx);
          const selecting = !prev.has(jobId);
          for (let i = start; i <= end; i++) {
            const it = items[i];
            if (!it) continue;
            if (selecting) next.set(it.id, it.suggestionId ?? null);
            else next.delete(it.id);
          }
        } else {
          // Toggle simples
          if (next.has(jobId)) next.delete(jobId);
          else next.set(jobId, suggestionId ?? null);
        }
        return next;
      });

      lastIndexRef.current = idx;
    },
    [items, indexOf]
  );

  const selectAllVisible = useCallback(() => {
    setSelectedMap((prev) => {
      const next = new Map(prev);
      for (const it of items) {
        if (it?.id) next.set(it.id, it.suggestionId ?? null);
      }
      return next;
    });
  }, [items]);

  const clearAllVisible = useCallback(() => {
    setSelectedMap((prev) => {
      if (prev.size === 0) return prev;
      const next = new Map(prev);
      for (const it of items) {
        if (it?.id) next.delete(it.id);
      }
      return next;
    });
  }, [items]);

  const clear = useCallback(() => setSelectedMap(new Map()), []);

  const selectedCount = selectedMap.size;

  return {
    selectedMap,
    selectedCount,
    isSelected,
    toggle,
    selectAllVisible,
    clearAllVisible,
    clear,
    setSelectedMap,
  };
}
