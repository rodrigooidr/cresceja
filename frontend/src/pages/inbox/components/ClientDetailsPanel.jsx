// src/pages/inbox/components/ClientDetailsPanel.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import inboxApi from "../../../api/inboxApi";
import useToastFallback from "../../../hooks/useToastFallback";

export default function ClientDetailsPanel({ conversation, onApplyTags, addToast: addToastProp, onSchedule }) {
  const addToast = useToastFallback(addToastProp);
  const [client, setClient] = useState(null);

  // Estados locais (editáveis)
  const [birthDate, setBirthDate] = useState("");
  const [notes, setNotes] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  // Tags
  const [tags, setTags] = useState([]);
  const [tagInput, setTagInput] = useState("");
  const dirtyRef = useRef({ birthdate: false, notes: false, tags: false });

  const handleSchedule = () => {
    if (!conversation) return;
    onSchedule?.({ conversation, client });
  };

  useEffect(() => {
    if (!conversation?.id) return;
    dirtyRef.current = { birthdate: false, notes: false, tags: false };
    (async () => {
      try {
        const { data } = await inboxApi.get(`/inbox/conversations/${conversation.id}/client`);
        setClient(data);
        if (!dirtyRef.current.birthdate) setBirthDate(data.birthdate || "");
        if (!dirtyRef.current.notes) setNotes(data.notes || "");
        if (!dirtyRef.current.tags) setTags(data.tags || []);
      } catch {
        setClient(null);
      }
    })();
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
    if (!conversation?.id) return;
    setIsSaving(true);
    try {
      const payload = {};
      if (birthDate && birthDate !== (client?.birthdate || "")) {
        const iso = birthDate.includes("/")
          ? birthDate.split("/").reverse().join("-")
          : birthDate;
        payload.birthdate = iso;
      }
      if (notes !== (client?.notes || "")) payload.notes = notes;
      if (JSON.stringify(tags) !== JSON.stringify(client?.tags || [])) payload.tags = tags;

      if (Object.keys(payload).length === 0) {
        addToast({ kind: "info", text: "Nada para salvar" });
        return;
      }

      const { data } = await inboxApi.put(
        `/inbox/conversations/${conversation.id}/client`,
        payload
      );
      setClient(data.client || data);
      dirtyRef.current = { birthdate: false, notes: false, tags: false };
      addToast({ kind: "success", text: "Dados do cliente salvos" });
    } catch (err) {
      addToast({
        kind: "error",
        text: `Erro ao salvar: ${err?.response?.data?.message || err.message}`,
      });
    } finally {
      setIsSaving(false);
    }
  };

  const addTag = () => {
    const t = (tagInput || "").trim();
    if (!t) return;
    if (!tags.includes(t)) {
      const next = [...tags, t];
      dirtyRef.current.tags = true;
      setTags(next);
      onApplyTags?.(next);
    }
    setTagInput("");
  };

  const removeTag = (t) => {
    dirtyRef.current.tags = true;
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
      <div className="flex items-center justify-between gap-2">
        <div>
          <h3 className="font-semibold text-sm">{fullName}</h3>
          <p className="text-xs text-gray-500">
            {channelLabel} • #{conversation?.id || "—"}
          </p>
        </div>
        <button
          type="button"
          className="px-3 py-1.5 rounded-lg text-xs font-medium border bg-blue-50 text-blue-700 hover:bg-blue-100 disabled:opacity-60"
          onClick={handleSchedule}
          disabled={!conversation}
        >
          Agendar
        </button>
      </div>

      {/* Informações básicas (somente leitura se não houver cliente) */}
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
        <label
          className="block text-xs font-semibold mb-1"
          htmlFor="client-details-birthdate"
        >
          Data de nascimento
        </label>
        <input
          id="client-details-birthdate"
          type="text"
          className="w-full px-3 py-2 border rounded-lg text-sm"
          value={birthDate || ""}
          onChange={(e) => {
            dirtyRef.current.birthdate = true;
            setBirthDate(e.target.value);
          }}
          disabled={!conversation}
        />
      </div>

      {/* Outras informações (área grande + scroll) */}
      <div>
        <label
          className="block text-xs font-semibold mb-1"
          htmlFor="client-details-notes"
        >
          Outras informações
        </label>
        <textarea
          id="client-details-notes"
          className="w-full px-3 py-2 border rounded-lg text-sm min-h-[140px] max-h-[320px] overflow-auto"
          placeholder="Observações gerais, preferências, histórico…"
          value={notes}
          onChange={(e) => {
            dirtyRef.current.notes = true;
            setNotes(e.target.value);
          }}
          disabled={!conversation}
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
            isSaving ? "bg-gray-400" : "bg-blue-600 hover:bg-blue-700"
          }`}
          onClick={handleSave}
          disabled={!conversation || isSaving}
        >
          {isSaving ? "Salvando..." : "Salvar alterações"}
        </button>
      </div>
    </div>
  );
}
