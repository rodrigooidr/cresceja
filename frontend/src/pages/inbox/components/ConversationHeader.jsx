// src/pages/inbox/components/ConversationHeader.jsx
import React, { useMemo, useState } from "react";

/**
 * Props:
 * - conversation: { id, client_name?, channel?, status? }
 * - onMoveToFunnel: () => Promise<void> | void
 * - onSetStatus: (status: "open"|"pending"|"closed") => Promise<void> | void
 * - onToggleAI: (enabled: boolean) => Promise<void> | void
 */
export default function ConversationHeader({ conversation, onMoveToFunnel, onSetStatus, onToggleAI }) {
  const [changing, setChanging] = useState(false);
  const [aiChanging, setAiChanging] = useState(false);

  const title = useMemo(() => {
    if (!conversation) return "Selecione uma conversa";
    return conversation.client_name || conversation.client?.name || `#${conversation.id}`;
  }, [conversation]);

  const status = (conversation?.status || "open").toLowerCase();

  const changeStatus = async (next) => {
    if (!conversation || status === next) return;
    setChanging(true);
    try {
      await onSetStatus?.(next);
    } finally {
      setChanging(false);
    }
  };

  const toggleAI = async (ev) => {
    if (!conversation) return;
    const enabled = ev.target.checked;
    setAiChanging(true);
    try {
      await onToggleAI?.(enabled);
    } finally {
      setAiChanging(false);
    }
  };

  return (
    <header className="mb-3 px-3 py-2 border rounded-xl bg-white shadow-sm flex items-center justify-between">
      <div className="min-w-0">
        <h2 className="font-semibold text-sm truncate">{title}</h2>
        {!!conversation && (
          <p className="text-xs text-gray-500 truncate">
            {labelChannel(conversation.channel)} • #{conversation.id}
          </p>
        )}
      </div>

      <div className="flex items-center gap-2">
        {/* Status */}
        <div className="flex items-center gap-1">
          <span className="text-xs text-gray-500">Status:</span>
          <select
            className="px-2 py-1 border rounded-md text-xs"
            value={status}
            onChange={(e) => changeStatus(e.target.value)}
            disabled={!conversation || changing}
          >
            <option value="open">Aberta</option>
            <option value="pending">Pendente</option>
            <option value="closed">Fechada</option>
          </select>
        </div>

        {/* IA toggle */}
        <label className="flex items-center gap-1 text-xs">
          <span>IA</span>
          <input
            type="checkbox"
            checked={!!conversation?.ai_enabled}
            onChange={toggleAI}
            disabled={!conversation || aiChanging}
          />
        </label>

        {/* Enviar para o Funil */}
        <button
          type="button"
          className="px-3 py-1.5 rounded-md bg-blue-600 text-white text-xs hover:bg-blue-700 disabled:bg-gray-400"
          onClick={() => onMoveToFunnel?.()}
          disabled={!conversation}
          title="Criar oportunidade no CRM a partir desta conversa"
        >
          Enviar para o Funil
        </button>
      </div>
    </header>
  );
}

function labelChannel(ch = "") {
  if (!ch) return "Canal";
  return ch[0].toUpperCase() + ch.slice(1);
}
