// src/pages/inbox/InboxPage.jsx
import React, { useEffect, useMemo, useState, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import inboxApi from "../../api/inboxApi";
import normalizeMessage from "../../inbox/normalizeMessage";
import channelIconBySlug from "../../inbox/channelIcons";

// Componentes (serão enviados na sequência)
import ConversationList from "./components/ConversationList.jsx";
import ConversationHeader from "./components/ConversationHeader.jsx";
import MessageList from "./components/MessageList.jsx";
import MessageComposer from "./components/MessageComposer.jsx";
import SidebarFilters from "./components/SidebarFilters.jsx";
import ClientDetailsPanel from "./components/ClientDetailsPanel.jsx";
import AttachmentPreview from "./components/AttachmentPreview.jsx";

// ------------------------------------------------------------
// Helper: fallback de toast para evitar "addToast is not a function"
// ------------------------------------------------------------
function useToastFallback(externalToast) {
  return useCallback(
    (opts) => {
      const payload =
        typeof opts === "string" ? { title: opts } : { ...opts };
      if (typeof externalToast === "function") {
        externalToast(payload);
        return;
      }
      if (window?.toast && typeof window.toast === "function") {
        window.toast(payload);
        return;
      }
      // Fallback simples
      const prefix = payload.variant === "destructive" ? "Erro" : "Info";
      // eslint-disable-next-line no-alert
      window.alert(`${prefix}: ${payload.title || "Operação concluída"}`);
      // eslint-disable-next-line no-console
      console.log("[toast]", payload);
    },
    [externalToast]
  );
}

export default function InboxPage({ addToast: addToastProp }) {
  const addToast = useToastFallback(addToastProp);
  const [searchParams, setSearchParams] = useSearchParams();

  // ------------------------------------------------------------
  // Filtros de URL (status, canal, tags, busca)
  // ------------------------------------------------------------
  const [filters, setFilters] = useState(() => ({
    q: searchParams.get("q") || "",
    status: searchParams.get("status") || "open", // open | pending | closed
    channel: searchParams.get("channel") || "all", // all | whatsapp | instagram | facebook | ...
    tags: searchParams.getAll("tag") || [], // ?tag=vip&tag=retornar
  }));

  // Sincroniza filtros -> URL
  useEffect(() => {
    const params = new URLSearchParams();
    if (filters.q) params.set("q", filters.q);
    if (filters.status) params.set("status", filters.status);
    if (filters.channel && filters.channel !== "all")
      params.set("channel", filters.channel);
    (filters.tags || []).forEach((t) => params.append("tag", t));
    setSearchParams(params, { replace: true });
  }, [filters, setSearchParams]);

  // ------------------------------------------------------------
  // Conversas e seleção atual
  // ------------------------------------------------------------
  const [conversations, setConversations] = useState([]);
  const [loadingConvs, setLoadingConvs] = useState(false);
  const [selectedId, setSelectedId] = useState(() => searchParams.get("c") || null);

  // Carrega conversas conforme filtros
  const fetchConversations = useCallback(async () => {
    try {
      setLoadingConvs(true);
      const { data } = await inboxApi.get("/inbox/conversations", {
        params: {
          q: filters.q || undefined,
          status: filters.status || undefined,
          channel: filters.channel !== "all" ? filters.channel : undefined,
          tag: filters.tags && filters.tags.length ? filters.tags : undefined,
          limit: 50,
        },
      });
      setConversations(Array.isArray(data) ? data : []);
    } catch (err) {
      addToast({
        title: "Falha ao carregar conversas",
        description: err?.response?.data?.message || err.message,
        variant: "destructive",
      });
    } finally {
      setLoadingConvs(false);
    }
  }, [filters, addToast]);

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  // Mantém ?c=<id> na URL
  useEffect(() => {
    if (!selectedId) return;
    const params = new URLSearchParams(searchParams);
    params.set("c", selectedId);
    setSearchParams(params, { replace: true });
  }, [selectedId, searchParams, setSearchParams]);

  // ------------------------------------------------------------
  // Mensagens da conversa selecionada
  // ------------------------------------------------------------
  const [messages, setMessages] = useState([]);
  const [loadingMsgs, setLoadingMsgs] = useState(false);

  const selectedConversation = useMemo(
    () => conversations.find((c) => String(c.id) === String(selectedId)) || null,
    [conversations, selectedId]
  );

  const fetchMessages = useCallback(
    async (convId) => {
      if (!convId) return;
      try {
        setLoadingMsgs(true);
        const { data } = await inboxApi.get(`/inbox/conversations/${convId}/messages`, {
          params: { limit: 200 },
        });
        const list = Array.isArray(data) ? data.map(normalizeMessage) : [];
        setMessages(list);
      } catch (err) {
        addToast({
          title: "Falha ao carregar mensagens",
          description: err?.response?.data?.message || err.message,
          variant: "destructive",
        });
      } finally {
        setLoadingMsgs(false);
      }
    },
    [addToast]
  );

  useEffect(() => {
    if (selectedId) fetchMessages(selectedId);
  }, [selectedId, fetchMessages]);

  // ------------------------------------------------------------
  // Envio de mensagens (texto/anexo)
  // ------------------------------------------------------------
  const sendMessage = useCallback(
    async ({ text, files }) => {
      if (!selectedId) return;
      try {
        const form = new FormData();
        if (text) form.append("text", text);
        (files || []).forEach((f) => form.append("files", f));
        const { data } = await inboxApi.post(
          `/inbox/conversations/${selectedId}/messages`,
          form,
          { headers: { "Content-Type": "multipart/form-data" } }
        );
        const newMsg = normalizeMessage(data);
        setMessages((prev) => [...prev, newMsg]);
      } catch (err) {
        addToast({
          title: "Não foi possível enviar",
          description: err?.response?.data?.message || err.message,
          variant: "destructive",
        });
      }
    },
    [selectedId, addToast]
  );

  // ------------------------------------------------------------
  // Ações: enviar para o funil (CRM), mudar status, aplicar tag...
  // ------------------------------------------------------------
  const moveToFunnel = useCallback(async () => {
    if (!selectedId) return;
    try {
      await inboxApi.post(`/crm/funnel/from-conversation`, {
        conversation_id: selectedId,
      });
      addToast({ title: "Enviado para o funil com sucesso 🎯" });
    } catch (err) {
      addToast({
        title: "Erro ao enviar para o funil",
        description: err?.response?.data?.message || err.message,
        variant: "destructive",
      });
    }
  }, [selectedId, addToast]);

  const setStatus = useCallback(
    async (status) => {
      if (!selectedId) return;
      try {
        await inboxApi.put(`/inbox/conversations/${selectedId}/status`, { status });
        setConversations((prev) =>
          prev.map((c) => (String(c.id) === String(selectedId) ? { ...c, status } : c))
        );
        addToast({ title: "Status atualizado" });
      } catch (err) {
        addToast({
          title: "Falha ao atualizar status",
          description: err?.response?.data?.message || err.message,
          variant: "destructive",
        });
      }
    },
    [selectedId, addToast]
  );

  const applyTags = useCallback(
    async (tags) => {
      if (!selectedId) return;
      try {
        await inboxApi.put(`/inbox/conversations/${selectedId}/tags`, { tags });
        setConversations((prev) =>
          prev.map((c) => (String(c.id) === String(selectedId) ? { ...c, tags } : c))
        );
        addToast({ title: "Tags atualizadas" });
      } catch (err) {
        addToast({
          title: "Falha ao atualizar tags",
          description: err?.response?.data?.message || err.message,
          variant: "destructive",
        });
      }
    },
    [selectedId, addToast]
  );

  // ------------------------------------------------------------
  // Render
  // ------------------------------------------------------------
  return (
    <div className="inbox grid grid-cols-12 gap-4 h-full p-4">
      {/* Coluna esquerda: filtros + lista */}
      <aside className="col-span-3 flex flex-col min-w-[280px]">
        <SidebarFilters
          value={filters}
          onChange={setFilters}
          channelIconBySlug={channelIconBySlug}
        />
        <div className="mt-3 flex-1 overflow-auto border rounded-xl">
          <ConversationList
            loading={loadingConvs}
            items={conversations}
            selectedId={selectedId}
            onSelect={setSelectedId}
          />
        </div>
      </aside>

      {/* Coluna central: conversa */}
      <main className="col-span-6 flex flex-col h-full">
        <ConversationHeader
          conversation={selectedConversation}
          onMoveToFunnel={moveToFunnel}
          onSetStatus={setStatus}
        />
        <div className="flex-1 overflow-auto border rounded-xl">
          <MessageList
            loading={loadingMsgs}
            messages={messages}
            conversation={selectedConversation}
          />
        </div>
        <div className="mt-3">
          <MessageComposer onSend={sendMessage} />
          {/* Caso use previews locais antes do envio */}
          <AttachmentPreview />
        </div>
      </main>

      {/* Coluna direita: dados do cliente */}
      <aside className="col-span-3">
        <ClientDetailsPanel
          conversation={selectedConversation}
          onApplyTags={applyTags}
        />
      </aside>
    </div>
  );
}
