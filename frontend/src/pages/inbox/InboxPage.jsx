// src/pages/inbox/InboxPage.jsx
import React, { useEffect, useMemo, useState, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import inboxApi from "../../api/inboxApi";
import normalizeMessage from "../../inbox/normalizeMessage";
import channelIconBySlug from "../../inbox/channelIcons";
import * as socketMod from "../../sockets/socket";
import { listConversations, getMessages, sendMessage as sendMessageApi } from "../../inbox/inbox.service";
import { useOrg } from "../../contexts/OrgContext";
import useOrgRefetch from "../../hooks/useOrgRefetch";
import useActiveOrgGate from "../../hooks/useActiveOrgGate";

import ConversationList from "./components/ConversationList.jsx";
import ConversationHeader from "./components/ConversationHeader.jsx";
import MessageList from "./components/MessageList.jsx";
import MessageComposer from "./components/MessageComposer.jsx";
import SidebarFilters from "./components/SidebarFilters.jsx";
import ClientDetailsPanel from "./components/ClientDetailsPanel.jsx";
import useToastFallback from "../../hooks/useToastFallback";
import ChannelPicker from "../../components/inbox/ChannelPicker.jsx";

export default function InboxPage({ addToast: addToastProp }) {
  const addToast = useToastFallback(addToastProp);
  const [searchParams, setSearchParams] = useSearchParams();
  const { allowed } = useActiveOrgGate();
  const { selected: orgId } = useOrg();

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
  const [channelId, setChannelId] = useState(() => {
    try {
      return localStorage.getItem('active_channel_id');
    } catch {
      return null;
    }
  });

  const fetchConversations = useCallback(async () => {
    if (!orgId) return;
    try {
      setLoadingConvs(true);
      const data = await listConversations({
        q: filters.q || undefined,
        status: filters.status || undefined,
        channel: filters.channel !== "all" ? filters.channel : undefined,
        tags: filters.tags && filters.tags.length ? filters.tags : undefined,
        limit: 50,
      });
      setConversations(Array.isArray(data?.items) ? data.items : []);
    } catch (err) {
      addToast({
        title: "Falha ao carregar conversas",
        description: err?.response?.data?.message || err.message,
        variant: "destructive",
      });
    } finally {
      setLoadingConvs(false);
    }
  }, [filters, addToast, orgId]);

  useOrgRefetch(fetchConversations, [fetchConversations]);

  useEffect(() => {
    fetchConversations();
  }, [channelId, fetchConversations]);

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

  useEffect(() => {
    async function load() {
      if (!selectedId) {
        setMessages([]);
        return;
      }
      setLoadingMsgs(true);
      try {
        const { items } = await getMessages(selectedId, { limit: 100 });
        const list = Array.isArray(items) ? items.map(normalizeMessage) : [];
        list.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
        setMessages(list);
        await markRead(selectedId);
      } catch (err) {
        addToast({
          title: "Falha ao carregar mensagens",
          description: err?.response?.data?.message || err.message,
          variant: "destructive",
        });
      } finally {
        setLoadingMsgs(false);
      }
    }
    load();
  }, [selectedId, addToast, markRead]);

  // ===== SOCKET =====
  const socket = socketMod.useSocket ? socketMod.useSocket() : socketMod.makeSocket?.();
  useEffect(() => {
    return () => {
      try {
        socket?.removeAllListeners?.();
        socket?.close?.();
        socket?.disconnect?.();
      } catch {
        /* noop */
      }
    };
  }, [socket]);

  useEffect(() => {
    if (socket && orgId) {
      socket.emit('org:switch', { orgId });
    }
  }, [socket, orgId]);

  useEffect(() => {
    if (!socket || !selectedId) return;
    socket.emit('inbox:join', { room: `conv:${selectedId}` });
    const onNew = (msg) => {
      if (String(msg.conversationId) === String(selectedId)) {
        setMessages((prev) => [...prev, normalizeMessage(msg)]);
      } else {
        setConversations((prev) =>
          prev.map((c) =>
            String(c.id) === String(msg.conversationId)
              ? { ...c, unread_count: Math.max(1, (c.unread_count || 0) + 1) }
              : c
          )
        );
      }
    };
    socket.on('inbox:message:new', onNew);
    return () => {
      socket.off('inbox:message:new', onNew);
      socket.emit('inbox:leave', { room: `conv:${selectedId}` });
    };
  }, [socket, selectedId, setConversations]);

  // ===== ENVIAR =====
  const handleSend = useCallback(
    async ({ text, file }) => {
      if (!selectedId) return;
      const optimistic = {
        id: `temp-${Date.now()}`,
        conversationId: selectedId,
        text: text || (file ? file.name : ''),
        direction: 'out',
        authorId: 'me',
        created_at: new Date().toISOString(),
        _optimistic: true,
      };
      setMessages((prev) => [...prev, optimistic]);

      try {
        const saved = await sendMessageApi({ conversationId: selectedId, text, file });
        setMessages((prev) =>
          prev.map((m) => (m.id === optimistic.id ? normalizeMessage(saved) : m))
        );
      } catch {
        setMessages((prev) => prev.filter((m) => m.id !== optimistic.id));
      }
    },
    [selectedId]
  );

  const handleFiles = useCallback(
    async (fileList) => {
      const files = Array.from(fileList || []);
      for (const f of files) {
        await handleSend({ file: f });
      }
    },
    [handleSend]
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

  if (!allowed) return null;

  // ===== UI =====
  return (
    <div className="h-[calc(100vh-56px)] grid grid-cols-[320px_1fr_360px] overflow-hidden">
      <aside className="border-r overflow-y-auto flex flex-col">
        <div className="p-2 space-y-2">
          <ChannelPicker onChange={(id) => { setChannelId(id); setSelectedId(null); }} />
          <SidebarFilters
            value={filters}
            onChange={setFilters}
            channelIconBySlug={channelIconBySlug}
          />
        </div>
        <ConversationList
          loading={loadingConvs}
          items={conversations || []}
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
          <MessageComposer sel={selectedConversation} onSend={handleSend} onFiles={handleFiles} />
        </div>
      </main>

      <aside className="border-l overflow-y-auto">
        <ClientDetailsPanel
          conversation={selectedConversation}
          onApplyTags={applyTags}
          addToast={addToast}
        />
      </aside>
    </div>
  );
}
