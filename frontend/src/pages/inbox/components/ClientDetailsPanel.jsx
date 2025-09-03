// src/pages/inbox/components/ClientDetailsPanel.jsx
import React, { useEffect, useMemo, useState } from "react";
import inboxApi from "../../../api/inboxApi";

export default function ClientDetailsPanel({ conversation, onApplyTags }) {
  const client = conversation?.client || null;
  const clientId = client?.id || null;

  // Estados locais (editáveis)
  const [birthDate, setBirthDate] = useState(client?.birth_date || "");
  const [extraInfo, setExtraInfo] = useState(client?.extra_info || "");
  const [saving, setSaving] = useState(false);

  // Tags
  const [tags, setTags] = useState(conversation?.tags || []);
  const [tagInput, setTagInput] = useState("");

  useEffect(() => {
    setBirthDate(client?.birth_date || "");
    setExtraInfo(client?.extra_info || "");
  }, [clientId]);

  useEffect(() => {
    setTags(conversation?.tags || []);
  }, [conversation?.id]);

  const fullName = useMemo(() => {
    return client?.name || client?.full_name || conversation?.client_name || "Cliente";
  }, [client, conversation]);

  const channelLabel = useMemo(() => {
    const ch = conversation?.channel || "";
    if (!ch) return "Canal";
    return ch.charAt(0).toUpperCase() + ch.slice(1);
  }, [conversation]);

  const handleSave = async () => {
    if (!clientId) return;
    setSaving(true);
    try {
      await inboxApi.put(`/clients/${clientId}`, {
        birth_date: birthDate || null,
        extra_info: extraInfo || "",
      });
      // opcional: feedback visual simples
      // eslint-disable-next-line no-alert
      window.alert("Dados do cliente salvos com sucesso.");
    } catch (err) {
      // eslint-disable-next-line no-alert
      window.alert(`Erro ao salvar: ${err?.response?.data?.message || err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const addTag = () => {
    const t = (tagInput || "").trim();
    if (!t) return;
    if (!tags.includes(t)) {
      const next = [...tags, t];
      setTags(next);
      onApplyTags?.(next);
    }
    setTagInput("");
  };

  const removeTag = (t) => {
    const next = tags.filter((x) => x !== t);
    setTags(next);
    onApplyTags?.(next);
  };

  const handleTagKeyDown = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      addTag();
    }
  };

  return (
    <div className="client-details-panel border rounded-xl bg-white shadow-sm p-3 space-y-3 h-full">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-sm">{fullName}</h3>
          <p className="text-xs text-gray-500">
            {channelLabel} • #{conversation?.id || "—"}
          </p>
        </div>
        {/* Botão de enviar para funil poderia ficar no header da conversa; aqui mantemos foco nos dados do cliente */}
      </div>

      {/* Informações básicas (somente leitura se não houver clientId) */}
      <div className="space-y-2 text-sm">
        {client?.phone && (
          <div className="flex items-center justify-between gap-2">
            <span className="text-gray-500">Telefone</span>
            <span className="font-medium">{client.phone}</span>
          </div>
        )}
        {client?.email && (
          <div className="flex items-center justify-between gap-2">
            <span className="text-gray-500">E-mail</span>
            <span className="font-medium truncate">{client.email}</span>
          </div>
        )}
      </div>

      {/* Data de nascimento */}
      <div>
        <label className="block text-xs font-semibold mb-1">Data de nascimento</label>
        <input
          type="date"
          className="w-full px-3 py-2 border rounded-lg text-sm"
          value={birthDate || ""}
          onChange={(e) => setBirthDate(e.target.value)}
          disabled={!clientId}
        />
      </div>

      {/* Outras informações (área grande + scroll) */}
      <div>
        <label className="block text-xs font-semibold mb-1">Outras informações</label>
        <textarea
          className="w-full px-3 py-2 border rounded-lg text-sm min-h-[140px] max-h-[320px] overflow-auto"
          placeholder="Observações gerais, preferências, histórico…"
          value={extraInfo}
          onChange={(e) => setExtraInfo(e.target.value)}
          disabled={!clientId}
        />
      </div>

      {/* Tags */}
      <div>
        <label className="block text-xs font-semibold mb-1">Tags</label>
        <div className="flex flex-wrap gap-2 mb-2">
          {tags?.map((t) => (
            <span
              key={t}
              className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs border bg-gray-50"
            >
              {t}
              <button
                type="button"
                className="px-1 py-0.5 border rounded hover:bg-gray-100"
                onClick={() => removeTag(t)}
                aria-label={`Remover tag ${t}`}
              >
                ×
              </button>
            </span>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            className="flex-1 px-3 py-2 border rounded-lg text-sm"
            placeholder="Adicionar tag e pressionar Enter"
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={handleTagKeyDown}
          />
          <button
            type="button"
            className="px-3 py-2 border rounded-lg bg-white"
            onClick={addTag}
          >
            Adicionar
          </button>
        </div>
      </div>

      {/* Ações */}
      <div className="pt-2">
        <button
          type="button"
          className={`w-full px-4 py-2 rounded-lg text-white ${
            saving ? "bg-gray-400" : "bg-blue-600 hover:bg-blue-700"
          }`}
          onClick={handleSave}
          disabled={!clientId || saving}
        >
          {saving ? "Salvando..." : "Salvar alterações"}
        </button>
      </div>
    </div>
  );
}
