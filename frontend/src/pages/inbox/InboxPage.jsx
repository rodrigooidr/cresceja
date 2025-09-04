// src/pages/inbox/InboxPage.jsx
import React, { useEffect, useMemo, useState, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import inboxApi from "../../api/inboxApi";
import normalizeMessage from "../../inbox/normalizeMessage";
import channelIconBySlug from "../../inbox/channelIcons";
import { makeSocket } from "../../sockets/socket";

import ConversationList from "./components/ConversationList.jsx";
import ConversationHeader from "./components/ConversationHeader.jsx";
import MessageList from "./components/MessageList.jsx";
import MessageComposer from "./components/MessageComposer.jsx";
import SidebarFilters from "./components/SidebarFilters.jsx";
import ClientDetailsPanel from "./components/ClientDetailsPanel.jsx";
import AttachmentPreview from "./components/AttachmentPreview.jsx";
import useToastFallback from "../../hooks/useToastFallback";

/** Constrói URL absoluta para assets quando o backend retorna caminho relativo */
function toApiUrl(path) {
  if (!path) return path;
  if (/^https?:\/\//i.test(path)) return path;
  const base = process.env.REACT_APP_API_BASE_URL || "http://localhost:4000/api";
  const slash = path.startsWith("/") ? "" : "/";
  return `${base}${slash}${path}`;
}

export default function InboxPage({ addToast: addToastProp }) {
  const addToast = useToastFallback(addToastProp);
  const [searchParams, setSearchParams] = useSearchParams();

  // ===== FILTROS =====
  const [filters, setFilters] = useState(() => ({
    q: searchParams.get("q") || "",
    status: searchParams.get("status") || "open",
    channel: searchParams.get("channel") || "all",
    tags: searchParams.getAll("tag") || [],
  }));

  useEffect(() => {
    const params = new URLSearchParams();
    if (filters.q) params.set("q", filters.q);
    if (filters.status) params.set("status", filters.status);
    if (filters.channel && filters.channel !== "all")
      params.set("channel", filters.channel);
    (filters.tags || []).forEach((t) => params.append("tag", t));
    setSearchParams(params, { replace: true });
  }, [filters, setSearchParams]);

  // ===== CONVERSAS =====
  const [conversations, setConversations] = useState([]);
  const [loadingConvs, setLoadingConvs] = useState(false);
  const [selectedId, setSelectedId] = useState(() => searchParams.get("c") || null);

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

  useEffect(() => {
    if (!selectedId) return;
    const params = new URLSearchParams(searchParams);
    params.set("c", selectedId);
    setSearchParams(params, { replace: true });
  }, [selectedId, searchParams, setSearchParams]);

  const markRead = useCallback(async (conversationId) => {
    setConversations((prev) =>
      prev.map((c) =>
        String(c.id) === String(conversationId) ? { ...c, unread_count: 0 } : c
      )
    );
    try {
      await inboxApi.post(`/inbox/conversations/${conversationId}/read`);
    } catch {
      /* noop */
    }
  }, []);

  // ===== MENSAGENS =====
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
        const { data } = await inboxApi.get(
          `/inbox/conversations/${convId}/messages`,
          { params: { limit: 200 } }
        );
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

  // ===== SOCKET =====
  useEffect(() => {
    const sock = makeSocket();

    // novas mensagens: só entram se forem da conversa selecionada
    const onNewMessage = (evt) => {
      if (!evt?.message) return;
      const convId = evt.conversation_id || evt.message.conversation_id;
      if (String(convId) !== String(selectedId)) {
        // opcional: incrementar unread na lista
        setConversations((prev) =>
          prev.map((c) =>
            String(c.id) === String(convId)
              ? { ...c, unread_count: Math.max(1, (c.unread_count || 0) + 1) }
              : c
          )
        );
        return;
      }
      setMessages((prev) => [...prev, normalizeMessage(evt.message)]);
    };

    const onConvUpdated = (conv) => {
      if (!conv?.id) return;
      setConversations((prev) =>
        prev.map((c) => (String(c.id) === String(conv.id) ? { ...c, ...conv } : c))
      );
    };

    const onConvCreated = (conv) => {
      if (!conv?.id) return;
      setConversations((prev) => {
        const exists = prev.some((c) => String(c.id) === String(conv.id));
        return exists ? prev : [conv, ...prev];
      });
    };

    sock.on("inbox:message:new", onNewMessage);
    sock.on("inbox:conversation:update", onConvUpdated);
    sock.on("inbox:conversation:new", onConvCreated);

    return () => {
      try {
        sock.off("inbox:message:new", onNewMessage);
        sock.off("inbox:conversation:update", onConvUpdated);
        sock.off("inbox:conversation:new", onConvCreated);
        sock.removeAllListeners?.();
        sock.close?.();
        sock.disconnect?.();
      } catch {
        /* noop */
      }
    };
  }, [selectedId]);

  // ===== ANEXOS =====
  const [attachments, setAttachments] = useState([]);

  const handleFiles = useCallback(
    async (fileList) => {
      if (!selectedConversation) return;
      const files = Array.from(fileList || []);
      if (!files.length) return;

      // mostra pré-visualização local
      setAttachments((prev) => [
        ...prev,
        ...files.map((f) => ({
          id: "local-" + (crypto?.randomUUID?.() || Math.random().toString(36).slice(2)),
          name: f.name,
          localFile: f,
        })),
      ]);

      // faz upload individualmente (mantém feedback responsivo)
      for (const f of files) {
        const form = new FormData();
        form.append("files[]", f);
        try {
          const { data } = await inboxApi.post(
            `/inbox/conversations/${selectedConversation.id}/attachments`,
            form,
            { headers: { "Content-Type": "multipart/form-data" } }
          );

          const assets = Array.isArray(data?.assets) ? data.assets : [];
          setAttachments((prev) =>
            prev
              .filter((a) => a.localFile !== f)
              .concat(
                assets.map((a) => ({
                  id: a.asset_id || a.id || a.url || f.name,
                  url: toApiUrl(a.url),
                  thumb_url: toApiUrl(a.thumb_url),
                  filename: a.filename || a.name || f.name,
                  mime: a.mime_type || a.content_type,
                }))
              )
          );
        } catch (err) {
          // remove o preview local que falhou
          setAttachments((prev) => prev.filter((a) => a.localFile !== f));
          // eslint-disable-next-line no-console
          console.error("Upload failed", err);
          addToast({
            title: "Falha no upload do arquivo",
            description: err?.response?.data?.message || err.message,
            variant: "destructive",
          });
        }
      }
    },
    [selectedConversation, addToast]
  );

  const removeLocalAttachment = useCallback((file) => {
    setAttachments((prev) => prev.filter((a) => a.localFile !== file));
  }, []);

  // ===== ENVIAR =====
  const sendMessage = useCallback(
    async ({ text }) => {
      if (!selectedId) return;
      const hasText = !!(text && String(text).trim());
      if (!hasText && attachments.length === 0) return;

      try {
        const payload = {};
        if (hasText) payload.text = text.trim();
        if (attachments.length) payload.attachments = attachments.map((a) => a.id);

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

  // ===== AÇÕES =====
  const moveToFunnel = useCallback(async () => {
    if (!selectedId) return;
    try {
      await inboxApi.post(`/crm/funnel/from-conversation`, { conversation_id: selectedId });
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

  const toggleAi = useCallback(
    async (enabled) => {
      if (!selectedId) return;
      try {
        await inboxApi.put(`/inbox/conversations/${selectedId}/ai`, { enabled });
        setConversations((prev) =>
          prev.map((c) =>
            String(c.id) === String(selectedId) ? { ...c, ai_enabled: enabled } : c
          )
        );
        addToast({ title: 'IA atualizada' });
      } catch (err) {
        addToast({
          title: 'Falha ao atualizar IA',
          description: err?.response?.data?.message || err.message,
          variant: 'destructive',
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

  // ===== UI =====
  return (
    <div className="h-[calc(100vh-56px)] grid grid-cols-[320px_1fr_360px] overflow-hidden">
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

      <main className="overflow-y-auto flex flex-col">
        <ConversationHeader
          conversation={selectedConversation}
          onMoveToFunnel={moveToFunnel}
          onSetStatus={setStatus}
          onToggleAI={toggleAi}
        />
        <div className="flex-1 overflow-y-auto">
          <MessageList
            loading={loadingMsgs}
            messages={messages}
            conversation={selectedConversation}
          />
        </div>
        <div className="border-t p-2">
          {/* Se seu MessageComposer espera prop `conversation`, troque `sel` por `conversation` */}
          <MessageComposer sel={selectedConversation} onSend={sendMessage} onFiles={handleFiles} />
          <AttachmentPreview
            files={attachments.filter((a) => a.localFile).map((a) => a.localFile)}
            onRemove={removeLocalAttachment}
          />
        </div>
      </main>

      <aside className="border-l overflow-y-auto">
        <ClientDetailsPanel
          conversation={selectedConversation}
          onApplyTags={applyTags}
        />
      </aside>
    </div>
  );
}
