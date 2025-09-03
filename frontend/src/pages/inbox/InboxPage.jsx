// src/pages/inbox/InboxPage.jsx
import React, { useEffect, useMemo, useState, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import inboxApi, { apiUrl } from "../../api/inboxApi";
import normalizeMessage from "../../inbox/normalizeMessage";
import channelIconBySlug from "../../inbox/channelIcons";
import { makeSocket } from "../../sockets/socket";

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
  // ensure socket singleton is initialized
  useEffect(() => {
    const sock = makeSocket();
    return () => {
      try { sock.removeAllListeners(); sock.close?.(); sock.disconnect?.(); } catch {}
    };
  }, []);

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

  const markRead = useCallback(async (conversationId) => {
    setConversations((prev) =>
      prev.map((c) => (c.id === conversationId ? { ...c, unread_count: 0 } : c))
    );
    try {
      await inboxApi.post(`/conversations/${conversationId}/read`);
    } catch {}
  }, []);

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
        await markRead(convId);
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
    [addToast, markRead]
  );

  useEffect(() => {
    if (selectedId) fetchMessages(selectedId);
  }, [selectedId, fetchMessages]);

  // ------------------------------------------------------------
  // Anexos
  // ------------------------------------------------------------
  const [attachments, setAttachments] = useState([]);

  const handleFiles = useCallback(
    async (fileList) => {
      if (!selectedConversation) return;
      const files = Array.from(fileList || []);
      if (!files.length) return;

      setAttachments((prev) => [
        ...prev,
        ...files.map((f) => ({
          id: "local-" + crypto.randomUUID(),
          name: f.name,
          localFile: f,
        })),
      ]);

      for (const f of files) {
        const form = new FormData();
        form.append("files[]", f);
        try {
          const { data } = await inboxApi.post(
            `/conversations/${selectedConversation.id}/attachments`,
            form,
            { headers: { "Content-Type": "multipart/form-data" } }
          );
          const assets = Array.isArray(data?.assets) ? data.assets : [];
          setAttachments((prev) =>
            prev
              .filter((a) => a.localFile !== f)
              .concat(
                assets.map((a) => ({
                  id: a.id || a.asset_id || a.url,
                  url: a.url ? apiUrl(a.url) : undefined,
                  thumb_url: a.thumb_url ? apiUrl(a.thumb_url) : undefined,
                  filename: a.filename || a.name || f.name,
                  mime: a.mime_type || a.content_type,
                }))
              )
          );
        } catch (err) {
          setAttachments((prev) => prev.filter((a) => a.localFile !== f));
          console.error("Upload failed", err);
        }
      }
    },
    [selectedConversation]
  );

  const removeLocalAttachment = useCallback((file) => {
    setAttachments((prev) => prev.filter((a) => a.localFile !== file));
  }, []);

  // ------------------------------------------------------------
  // Envio de mensagens (texto + attachments já enviados)
  // ------------------------------------------------------------
  const sendMessage = useCallback(
    async ({ text }) => {
      if (!selectedId) return;
      if (!text && attachments.length === 0) return;
      try {
        const payload = { text };
        if (attachments.length)
          payload.attachments = attachments.map((a) => a.id);
        const { data } = await inboxApi.post(
          `/inbox/conversations/${selectedId}/messages`,
          payload
        );
        const newMsg = normalizeMessage(data);
        setMessages((prev) => [...prev, newMsg]);
        setAttachments([]);
      } catch (err) {
        addToast({
          title: "Não foi possível enviar",
          description: err?.response?.data?.message || err.message,
          variant: "destructive",
        });
      }
    },
    [selectedId, attachments, addToast]
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
    <div className="h-[calc(100vh-56px)] grid grid-cols-[320px_1fr_360px] overflow-hidden">
      {/* Coluna esquerda: filtros + lista */}
      <aside className="border-r overflow-y-auto flex flex-col">
        <SidebarFilters
          value={filters}
          onChange={setFilters}
          channelIconBySlug={channelIconBySlug}
        />
        <ConversationList
          loading={loadingConvs}
          items={conversations}
          selectedId={selectedId}
          onSelect={setSelectedId}
        />
      </aside>

      {/* Coluna central: conversa */}
      <main className="overflow-y-auto flex flex-col">
        <ConversationHeader
          conversation={selectedConversation}
          onMoveToFunnel={moveToFunnel}
          onSetStatus={setStatus}
        />
        <div className="flex-1 overflow-y-auto">
          <MessageList
            loading={loadingMsgs}
            messages={messages}
            conversation={selectedConversation}
          />
        </div>
        <div className="border-t p-2">
          <MessageComposer sel={selectedConversation} onSend={sendMessage} onFiles={handleFiles} />
          <AttachmentPreview
            files={attachments.filter((a) => a.localFile).map((a) => a.localFile)}
            onRemove={removeLocalAttachment}
          />
        </div>
      </main>

      {/* Coluna direita: dados do cliente */}
      <aside className="border-l overflow-y-auto">
        <ClientDetailsPanel
          conversation={selectedConversation}
          onApplyTags={applyTags}
        />
      </aside>
    </div>
  );
}
