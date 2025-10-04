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
import { useInboxAlerts } from "./hooks/useInboxAlerts.js";
import HandoffBanner from "./components/HandoffBanner.jsx";
import ScheduleModal from "./components/ScheduleModal.jsx";
import { authFetch } from "../../services/session.js";

export default function InboxPage({ addToast: addToastProp }) {
  const addToast = useToastFallback(addToastProp);
  const [searchParams, setSearchParams] = useSearchParams();
  const { allowed } = useActiveOrgGate();
  const { selected: orgId } = useOrg();
  const inboxAlerts = useInboxAlerts();

  // ===== FILTROS =====
  const [filters, setFilters] = useState(() => ({
    q: searchParams.get("q") || "",
    status: searchParams.get("status") || "open",
    channel: searchParams.get("channel") || "",
    accountId: searchParams.get("accountId") || "",
    tags: searchParams.getAll("tag") || [],
  }));

  useEffect(() => {
    const params = new URLSearchParams();
    if (filters.q) params.set("q", filters.q);
    if (filters.status) params.set("status", filters.status);
    if (filters.channel)
      params.set("channel", filters.channel);
    if (filters.accountId)
      params.set("accountId", filters.accountId);
    (filters.tags || []).forEach((t) => params.append("tag", t));
    setSearchParams(params, { replace: true });
  }, [filters, setSearchParams]);

  // ===== CONVERSAS =====
  const [conversations, setConversations] = useState([]);
  const [loadingConvs, setLoadingConvs] = useState(false);
  const [selectedId, setSelectedId] = useState(() => searchParams.get("c") || null);
  const [accounts, setAccounts] = useState([]);
  const [channelId, setChannelId] = useState(() => {
    try {
      if (!orgId) return null;
      const key = `active_channel_id::${orgId}`;
      const legacy = localStorage.getItem('active_channel_id');
      if (!localStorage.getItem(key) && legacy) {
        localStorage.setItem(key, legacy);
        localStorage.removeItem('active_channel_id');
      }
      return localStorage.getItem(key);
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
        channel: filters.channel || undefined,
        accountId: filters.accountId || undefined,
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
    async function loadAccounts() {
      if (filters.channel === 'instagram' || filters.channel === 'facebook') {
        try {
          const { data } = await inboxApi.get('/channels/meta/accounts', { params: { channel: filters.channel } });
          setAccounts(Array.isArray(data?.items) ? data.items : []);
        } catch {
          setAccounts([]);
        }
      } else {
        setAccounts([]);
        setFilters((f) => ({ ...f, accountId: '' }));
      }
    }
    loadAccounts();
  }, [filters.channel]);

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
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [scheduleContext, setScheduleContext] = useState(null);

  const selectedConversation = useMemo(
    () => conversations.find((c) => String(c.id) === String(selectedId)) || null,
    [conversations, selectedId]
  );

  const pendingAlerts = inboxAlerts.pending;
  const showHandoffBanner = useMemo(() => {
    if (!selectedConversation) return false;
    const currentId =
      selectedConversation?.id ?? selectedConversation?.conversation_id;
    if (!currentId) return false;
    const needsHuman =
      selectedConversation?.needs_human && !selectedConversation?.alert_sent;
    const pendingAlert =
      pendingAlerts?.has?.(currentId) || pendingAlerts?.has?.(String(currentId));
    return Boolean(needsHuman || pendingAlert);
  }, [selectedConversation, pendingAlerts]);
  const handleAckAlert = useCallback(async () => {
    if (!selectedConversation) return;
    const currentId =
      selectedConversation?.id ?? selectedConversation?.conversation_id;
    if (!currentId) return;
    await inboxAlerts.ack(currentId);
    setConversations((prev) =>
      prev.map((c) =>
        String(c.id) === String(currentId) ? { ...c, alert_sent: true } : c
      )
    );
  }, [selectedConversation, inboxAlerts, setConversations]);

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
  const [blocked, setBlocked] = useState(false);
  const handleSend = useCallback(
    async ({ text, file }) => {
      if (!selectedId || blocked) return;
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
      } catch (err) {
        if (err?.response?.data?.error === 'outside_24h') {
          setBlocked(true);
        }
        setMessages((prev) => prev.filter((m) => m.id !== optimistic.id));
      }
    },
    [selectedId, blocked]
  );

  useEffect(() => { setBlocked(false); }, [selectedId]);

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

  const openScheduleModal = useCallback(
    ({ conversation: conv, client: cli, defaultPersonName = "", defaultServiceName = "" } = {}) => {
      const baseConversation = conv || selectedConversation || null;
      const baseClient = cli || null;

      const displayName =
        baseClient?.name ||
        baseClient?.full_name ||
        baseClient?.display_name ||
        baseConversation?.client_name ||
        "";

      const contact = {
        id: baseClient?.id || baseConversation?.client_id || undefined,
        display_name: displayName || undefined,
        email: baseClient?.email || baseConversation?.client_email || undefined,
        phone_e164:
          baseClient?.phone_e164 ||
          baseConversation?.client_phone_e164 ||
          baseConversation?.client_phone ||
          undefined,
      };

      const hasContactInfo =
        Boolean(contact.id) ||
        Boolean(contact.display_name) ||
        Boolean(contact.email) ||
        Boolean(contact.phone_e164);

      setScheduleContext({
        contact: hasContactInfo ? contact : null,
        defaultPersonName,
        defaultServiceName,
        conversationId: baseConversation?.id || null,
      });
      setScheduleOpen(true);
    },
    [selectedConversation]
  );

  const closeScheduleModal = useCallback(() => {
    setScheduleOpen(false);
    setScheduleContext(null);
  }, []);

  const handleScheduledEvent = useCallback(
    (event) => {
      if (!event || !selectedId) {
        closeScheduleModal();
        return;
      }

      let startISO = null;
      const start = event?.start;
      if (typeof start === "string") {
        startISO = start;
      } else if (start?.dateTime) {
        startISO = start.dateTime;
      } else if (start?.date) {
        startISO = `${start.date}T00:00:00`;
      }

      let formatted = null;
      if (startISO) {
        const startDate = new Date(startISO);
        if (!Number.isNaN(startDate.getTime())) {
          formatted = `${startDate.toLocaleDateString("pt-BR")} ${startDate.toLocaleTimeString("pt-BR", {
            hour: "2-digit",
            minute: "2-digit",
          })}`;
        }
      }

      const personName =
        event?.extendedProperties?.private?.personName ||
        event?.extendedProperties?.shared?.personName ||
        event?.personName ||
        null;
      const summary = event?.summary || (personName ? `Atendimento com ${personName}` : "Atendimento");

      const parts = [];
      if (personName) {
        parts.push(`Agendado com ${personName}`);
      } else {
        parts.push(`Agendamento criado: ${summary}`);
      }
      if (formatted) parts.push(`em ${formatted}`);
      if (event.htmlLink) parts.push(`Abrir no Google: ${event.htmlLink}`);

      const messageId = `schedule-${Date.now()}`;
      const synthetic = {
        id: messageId,
        conversation_id: String(selectedId),
        text: parts.join(' — '),
        created_at: new Date().toISOString(),
        direction: 'out',
        sender: 'agent',
        type: 'text',
        actions: [],
      };

      const cancelAction = {
        label: 'Cancelar',
        style: 'danger',
        onClick: async () => {
          if (!event?.id) return;
          if (!window.confirm('Cancelar este agendamento?')) return;
          try {
            const queryParam = event.calendarId ? `?calendarId=${encodeURIComponent(event.calendarId)}` : '';
            const resp = await authFetch(`/api/calendar/events/${encodeURIComponent(event.id)}${queryParam}`, {
              method: 'DELETE',
            });
            if (!resp.ok) throw new Error('cancel_failed');
            setMessages((prev) =>
              prev.map((msg) =>
                msg.id === messageId
                  ? {
                      ...msg,
                      text: `${msg.text} — Cancelado`,
                      actions: [],
                    }
                  : msg,
              ),
            );
            setMessages((prev) => [
              ...prev,
              {
                id: `cancel-${Date.now()}`,
                conversation_id: String(selectedId),
                text: 'Evento cancelado com sucesso.',
                created_at: new Date().toISOString(),
                direction: 'out',
                sender: 'agent',
                type: 'text',
              },
            ]);
          } catch (err) {
            // eslint-disable-next-line no-alert
            alert('Falha ao cancelar. Tente novamente.');
          }
        },
      };

      const rescheduleAction = {
        label: 'Remarcar',
        onClick: () => {
          openScheduleModal({
            conversation: selectedConversation,
            defaultPersonName: event.__personName || personName || '',
            defaultServiceName: event.__serviceName || summary || '',
          });
        },
      };

      synthetic.actions = [cancelAction, rescheduleAction];

      setMessages((prev) => [...prev, synthetic]);
      closeScheduleModal();
    },
    [selectedId, setMessages, closeScheduleModal, openScheduleModal, selectedConversation]
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
            accounts={accounts}
            channelIconBySlug={channelIconBySlug}
          />
        </div>
        <ConversationList
          loading={loadingConvs}
          items={conversations || []}
          selectedId={selectedId}
          onSelect={setSelectedId}
          pendingAlerts={pendingAlerts}
        />
      </aside>

      <main className="overflow-y-auto flex flex-col">
        <ConversationHeader
          conversation={selectedConversation}
          onMoveToFunnel={moveToFunnel}
          onSetStatus={setStatus}
          onToggleAI={toggleAi}
        />
        <HandoffBanner show={showHandoffBanner} onAck={handleAckAlert} />
        <div className="flex-1 overflow-y-auto">
          <MessageList
            loading={loadingMsgs}
            messages={messages}
            conversation={selectedConversation}
          />
        </div>
        <div className="border-t p-2">
          {/* Se seu MessageComposer espera prop `conversation`, troque `sel` por `conversation` */}
          <MessageComposer sel={selectedConversation} onSend={handleSend} onFiles={handleFiles} disabled={blocked} disabledReason="Só é possível responder até 24h após a última mensagem neste canal." />
        </div>
      </main>

      <aside className="border-l overflow-y-auto">
        <ClientDetailsPanel
          conversation={selectedConversation}
          onApplyTags={applyTags}
          addToast={addToast}
          onSchedule={openScheduleModal}
        />
      </aside>
      <ScheduleModal
        open={scheduleOpen}
        onClose={closeScheduleModal}
        contact={scheduleContext?.contact || null}
        defaultPersonName={scheduleContext?.defaultPersonName || ""}
        defaultServiceName={scheduleContext?.defaultServiceName || ""}
        conversationId={scheduleContext?.conversationId || null}
        onScheduled={handleScheduledEvent}
      />
    </div>
  );
}
