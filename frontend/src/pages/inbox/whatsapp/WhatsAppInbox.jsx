import React from "react";
import { createWhatsAppClient } from "../../../integrations/whatsapp/client";
import inboxApi from "../../../api/inboxApi";
import { useInboxAlerts } from "../hooks/useInboxAlerts.js";
import UrgentBadge from "../components/UrgentBadge.jsx";
import HandoffBanner from "../components/HandoffBanner.jsx";
import ChannelBadge from "./ChannelBadge.jsx";
import TagEditor from "./TagEditor.jsx";
import ContactPanel from "./ContactPanel.jsx";

const EMPTY_PENDING = new Map();

function hasPendingAlert(pendingAlerts, conversationId) {
  if (!conversationId || !pendingAlerts || typeof pendingAlerts.has !== "function") {
    return false;
  }
  if (pendingAlerts.has(conversationId)) return true;
  const key = String(conversationId);
  if (pendingAlerts.has(key)) return true;
  return false;
}

function useWhatsAppClient({ transport = "cloud" } = {}) {
  const [client, setClient] = React.useState(null);
  React.useEffect(() => {
    const c = createWhatsAppClient({ transport });
    setClient(c);
    return () => {
      // client atual não precisa de teardown específico
    };
  }, [transport]);
  return client;
}

function useConversations(client) {
  const [convs, setConvs] = React.useState(new Map());
  const [active, setActive] = React.useState(null);
  const contactCache = React.useRef(new Map());

  const updateConv = React.useCallback((chatId, updater) => {
    if (!chatId || typeof updater !== "function") return;
    setConvs((prev) => {
      const next = new Map(prev);
      const base =
        next.get(chatId) || {
          id: chatId,
          title: chatId,
          messages: [],
          unread: 0,
          typing: "paused",
          contact: null,
          needs_human: false,
          alert_sent: false,
          conversation_id: chatId,
        };
      next.set(chatId, updater(base));
      return next;
    });
  }, []);

  const setContactForChat = React.useCallback(
    (chatId, contact) => {
      if (!chatId) return;
      contactCache.current.set(chatId, contact || null);
      updateConv(chatId, (conv) => {
        const nextTitle = contact?.name || conv.title;
        return { ...conv, contact: contact || null, title: nextTitle };
      });
    },
    [updateConv]
  );

  const ensureContact = React.useCallback(async (chatId) => {
    if (!chatId) return null;
    if (contactCache.current.has(chatId)) {
      return contactCache.current.get(chatId);
    }
    try {
      const { data } = await inboxApi.get(`/crm/contacts?phone=${encodeURIComponent(chatId)}`);
      const contact = data?.contact ?? null;
      contactCache.current.set(chatId, contact);
      return contact;
    } catch {
      contactCache.current.set(chatId, null);
      return null;
    }
  }, []);

  React.useEffect(() => {
    if (!client) return;
    const handleMessage = async (message) => {
      const contact = await ensureContact(message.chatId);
      updateConv(message.chatId, (conv) => {
        const exists = conv.messages.some((item) => item.id === message.id);
        const messages = exists
          ? conv.messages.map((item) => (item.id === message.id ? { ...item, ...message } : item))
          : [...conv.messages, message];
        const shouldIncrement = !exists && message.direction === "in" && active !== message.chatId;
        const unread = shouldIncrement ? conv.unread + 1 : conv.unread;
        const nextContact = contact ?? conv.contact ?? null;
        const title = nextContact?.name || conv.title || message.chatId;
        return { ...conv, messages, unread, contact: nextContact, title };
      });
      if (active === message.chatId && message.direction === "in") {
        client.markRead({ chatId: message.chatId, messageId: message.id }).catch(() => {});
      }
    };

    const offMsg = client.on("message", (m) => {
      handleMessage(m);
    });
    const offStatus = client.on("status", (status) => {
      updateConv(status.chatId, (conv) => ({
        ...conv,
        messages: conv.messages.map((item) =>
          item.id === status.messageId ? { ...item, status: status.status } : item
        ),
      }));
    });
    const offTyping = client.on("typing", (typing) => {
      updateConv(typing.chatId, (conv) => ({ ...conv, typing: typing.state }));
    });

    return () => {
      offMsg?.();
      offStatus?.();
      offTyping?.();
    };
  }, [client, active, ensureContact, updateConv]);

  const openChat = React.useCallback(
    async (chatId) => {
      if (!client) return;
      setActive(chatId);
      const [history, contact] = await Promise.all([
        client.fetchHistory({ chatId, limit: 30 }),
        ensureContact(chatId),
      ]);
      contactCache.current.set(chatId, contact);
      setConvs((prev) => {
        const next = new Map(prev);
        const base =
          next.get(chatId) || {
            id: chatId,
            title: chatId,
            messages: [],
            unread: 0,
            typing: "paused",
            contact: contact ?? null,
            needs_human: false,
            alert_sent: false,
            conversation_id: chatId,
          };
        const ids = new Set(base.messages.map((msg) => msg.id));
        const merged = [
          ...history.items.filter((msg) => !ids.has(msg.id)),
          ...base.messages,
        ];
        const nextContact = contact ?? base.contact ?? null;
        next.set(chatId, {
          ...base,
          messages: merged,
          unread: 0,
          contact: nextContact,
          title: nextContact?.name || base.title,
        });
        return next;
      });
      const lastIn = history.items.filter((msg) => msg.direction === "in").slice(-1)[0];
      if (lastIn) {
        client.markRead({ chatId, messageId: lastIn.id }).catch(() => {});
      }
    },
    [client, ensureContact]
  );

  const sendText = React.useCallback(
    async (chatId, text) => {
      if (!client) return;
      const trimmed = text ?? "";
      const tmpId = `tmp-${Math.random().toString(36).slice(2)}`;
      updateConv(chatId, (conv) => ({
        ...conv,
        messages: [
          ...conv.messages,
          {
            id: tmpId,
            chatId,
            from: "me",
            to: chatId,
            direction: "out",
            type: "text",
            text: trimmed,
            timestamp: Date.now(),
            status: "queued",
          },
        ],
      }));
      try {
        const msg = await client.sendText({ to: chatId, text: trimmed, chatId });
        updateConv(chatId, (conv) => ({
          ...conv,
          messages: conv.messages.map((item) => (item.id === tmpId ? msg : item)),
        }));
      } catch {
        updateConv(chatId, (conv) => ({
          ...conv,
          messages: conv.messages.map((item) =>
            item.id === tmpId ? { ...item, status: "failed" } : item
          ),
        }));
      }
    },
    [client, updateConv]
  );

  const sendMedia = React.useCallback(
    async (chatId, media, caption) => {
      if (!client) return;
      const tmpId = `tmp-${Math.random().toString(36).slice(2)}`;
      updateConv(chatId, (conv) => ({
        ...conv,
        messages: [
          ...conv.messages,
          {
            id: tmpId,
            chatId,
            from: "me",
            to: chatId,
            direction: "out",
            type: media?.type || "image",
            text: caption || "",
            media,
            timestamp: Date.now(),
            status: "queued",
          },
        ],
      }));
      try {
        const msg = await client.sendMedia({ to: chatId, media, caption, chatId });
        updateConv(chatId, (conv) => ({
          ...conv,
          messages: conv.messages.map((item) => (item.id === tmpId ? msg : item)),
        }));
      } catch {
        updateConv(chatId, (conv) => ({
          ...conv,
          messages: conv.messages.map((item) =>
            item.id === tmpId ? { ...item, status: "failed" } : item
          ),
        }));
      }
    },
    [client, updateConv]
  );

  const setTyping = React.useCallback(
    async (chatId, state) => {
      if (!client) return;
      try {
        await client.setTyping({ chatId, state });
      } catch {}
    },
    [client]
  );

  return {
    convs,
    active,
    openChat,
    sendText,
    sendMedia,
    setTyping,
    updateConv,
    setContactForChat,
  };
}

function ConversationList({
  convs,
  active,
  onOpen,
  tagFilter,
  onTagFilter,
  onAddTag,
  pendingAlerts = EMPTY_PENDING,
}) {
  const list = React.useMemo(() => {
    const ordered = Array.from(convs.values()).sort((a, b) => {
      const lastA = a.messages[a.messages.length - 1];
      const lastB = b.messages[b.messages.length - 1];
      const ta = lastA?.timestamp || 0;
      const tb = lastB?.timestamp || 0;
      return tb - ta;
    });
    if (!tagFilter) return ordered;
    const lowered = tagFilter.toLowerCase();
    return ordered.filter((conversation) =>
      (conversation.contact?.tags || []).some((tag) => tag.toLowerCase().includes(lowered))
    );
  }, [convs, tagFilter]);

  return (
    <div className="w-72 border-r flex flex-col" role="navigation" aria-label="Conversas">
      <div className="p-2 border-b">
        <input
          className="w-full border px-2 py-1 text-sm"
          placeholder="filtrar por tag…"
          value={tagFilter}
          onChange={(event) => onTagFilter(event.target.value)}
          data-testid="tag-filter"
        />
      </div>
      <div className="flex-1 overflow-auto">
        {list.length === 0 && <div className="p-3 text-sm opacity-70">Sem conversas.</div>}
        {list.map((conversation) => {
          const last = conversation.messages[conversation.messages.length - 1];
          const conversationId =
            conversation?.conversation_id ??
            conversation?.id ??
            conversation?.chat_id ??
            conversation?.chatId ??
            null;
          const needsHuman = conversation?.needs_human && !conversation?.alert_sent;
          const alsoPending = hasPendingAlert(pendingAlerts, conversationId);
          const showUrgent = Boolean(needsHuman || alsoPending);
          return (
            <button
              key={conversation.id}
              onClick={() => onOpen(conversation.id)}
              className={`w-full text-left p-3 border-b ${
                active === conversation.id ? "bg-gray-100" : ""
              }`}
              data-testid={`conv-${conversation.id}`}
            >
              <div className="flex items-center gap-1">
                <ChannelBadge channel={conversation.contact?.channel || "whatsapp"} />
                <div className="font-medium">
                  {conversation.contact?.name || conversation.title}
                  {showUrgent && <UrgentBadge />}
                </div>
              </div>
              <TagEditor
                tags={conversation.contact?.tags || []}
                onAdd={(tag) => onAddTag?.(conversation.id, tag)}
              />
              <div className="text-xs opacity-70 truncate">
                {last?.text || last?.type}
              </div>
              {conversation.unread > 0 && (
                <span className="inline-block mt-1 text-[10px] bg-blue-600 text-white px-1.5 rounded">
                  {conversation.unread}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function AIToggles({ chatId }) {
  const [globalEnabled, setGlobalEnabled] = React.useState(true);
  const [chatEnabled, setChatEnabled] = React.useState(null);

  React.useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const globalRes = await inboxApi.get("/ai/settings");
        if (!alive) return;
        setGlobalEnabled(Boolean(globalRes?.data?.enabledAll));
        if (chatId) {
          const chatRes = await inboxApi.get(`/ai/perChat?chatId=${encodeURIComponent(chatId)}`);
          if (!alive) return;
          setChatEnabled(chatRes?.data?.enabled ?? null);
        } else {
          setChatEnabled(null);
        }
      } catch {
        if (!alive) return;
        setChatEnabled(null);
      }
    })();
    return () => {
      alive = false;
    };
  }, [chatId]);

  const toggleGlobal = React.useCallback(async (value) => {
    setGlobalEnabled(value);
    try {
      await inboxApi.post("/ai/settings", { enabledAll: value });
    } catch {}
  }, []);

  const toggleChat = React.useCallback(
    async (value) => {
      if (!chatId) return;
      setChatEnabled(value);
      try {
        await inboxApi.post("/ai/perChat", { chatId, enabled: value });
      } catch {}
    },
    [chatId]
  );

  return (
    <div className="flex gap-3 text-xs items-center">
      <label className="flex items-center gap-1">
        <input type="checkbox" checked={globalEnabled} onChange={(event) => toggleGlobal(event.target.checked)} />
        IA Global
      </label>
      {chatId ? (
        <label className="flex items-center gap-1">
          <input
            type="checkbox"
            checked={(chatEnabled ?? globalEnabled) === true}
            onChange={(event) => toggleChat(event.target.checked)}
          />
          IA nesta conversa
        </label>
      ) : null}
    </div>
  );
}

function MessageBubble({ m, onTranscribe }) {
  const mine = m.direction === "out";
  return (
    <div className={`flex ${mine ? "justify-end" : "justify-start"} my-1`}>
      <div className={`max-w-[70%] rounded-xl p-2 text-sm shadow ${mine ? "bg-blue-50" : "bg-white"}`}>
        {m.type === "text" ? (
          <div>{m.text}</div>
        ) : m.type === "audio" ? (
          <div className="space-y-1">
            {m.media?.url ? <audio controls src={m.media.url} /> : <div>[áudio]</div>}
            <button
              type="button"
              className="text-[11px] underline"
              onClick={() => onTranscribe?.(m)}
              data-testid={`transcribe-${m.id}`}
            >
              Transcrever
            </button>
            {m.transcript ? (
              <div className="text-xs opacity-70 mt-1">“{m.transcript}”</div>
            ) : null}
          </div>
        ) : m.media?.type?.startsWith("image") ? (
          <figure>
            <img
              alt={m.media?.filename || "imagem"}
              src={m.media?.url}
              style={{ maxWidth: 240, borderRadius: 8 }}
            />
            {m.text ? <figcaption className="text-xs mt-1 opacity-70">{m.text}</figcaption> : null}
          </figure>
        ) : (
          <div>
            [{m.type}] {m.text}
          </div>
        )}
        <div className="text-[10px] opacity-60 mt-1">{m.status}</div>
      </div>
    </div>
  );
}

function ChatWindow({
  conv,
  onSend,
  onSendMedia,
  onTyping,
  onTranscribe,
  showHandoff = false,
  onAck,
}) {
  const [text, setText] = React.useState("");
  const [mediaUrl, setMediaUrl] = React.useState("");

  React.useEffect(() => setText(""), [conv?.id]);

  const handleSend = React.useCallback(() => {
    if (!conv?.id) return;
    if (text.trim()) {
      onSend(conv.id, text.trim());
      setText("");
      onTyping(conv.id, "paused");
    }
  }, [conv?.id, onSend, onTyping, text]);

  return (
    <div className="flex-1 flex flex-col h-full">
      <HandoffBanner show={showHandoff} onAck={onAck} />
      <div className="flex items-center justify-between p-3 border-b">
        <div>
          <div className="font-semibold">
            {conv
              ? `Conversando com ${conv.contact?.name || conv.title}`
              : "Selecione uma conversa"}
          </div>
          {conv?.typing === "composing" && (
            <div className="text-xs text-green-600" data-testid="typing">
              digitando…
            </div>
          )}
        </div>
      </div>
      <div className="flex-1 p-3 overflow-auto" role="log" aria-live="polite">
        {!conv && <div className="opacity-70 text-sm">Nenhuma conversa aberta.</div>}
        {conv &&
          conv.messages.map((msg) => (
            <MessageBubble key={msg.id} m={msg} onTranscribe={onTranscribe} />
          ))}
      </div>
      {conv && (
        <div className="p-3 border-t space-y-2">
          <div className="flex gap-2">
            <input
              placeholder="URL de imagem (opcional)"
              value={mediaUrl}
              onChange={(event) => setMediaUrl(event.target.value)}
              className="flex-1 border px-2 py-1 text-sm"
              data-testid="media-url"
            />
            <button
              onClick={() =>
                mediaUrl &&
                onSendMedia(conv.id, { type: "image/png", url: mediaUrl, mime: "image/png" }, "")
              }
              disabled={!mediaUrl}
              className="border px-3 py-1 text-sm"
              data-testid="send-media"
            >
              Enviar mídia
            </button>
          </div>
          <div className="flex gap-2">
            <textarea
              placeholder="Escreva uma mensagem"
              value={text}
              onChange={(event) => {
                setText(event.target.value);
                onTyping(conv.id, event.target.value ? "composing" : "paused");
              }}
              className="flex-1 border px-2 py-1 text-sm"
              rows={2}
              data-testid="composer"
            />
            <button
              onClick={handleSend}
              disabled={!text.trim()}
              className="border px-3 py-1 text-sm"
              data-testid="send-text"
            >
              Enviar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function WhatsAppInbox({ transport = "cloud" }) {
  const client = useWhatsAppClient({ transport });
  const { convs, active, openChat, sendText, sendMedia, setTyping, updateConv, setContactForChat } =
    useConversations(client);
  const [tagFilter, setTagFilter] = React.useState("");
  const { pending: pendingAlertsRaw, ack: ackAlert } = useInboxAlerts();
  const pendingAlerts = pendingAlertsRaw instanceof Map ? pendingAlertsRaw : EMPTY_PENDING;
  const activeConversation = active ? convs.get(active) : null;
  const activeConversationId =
    activeConversation?.conversation_id ??
    activeConversation?.id ??
    activeConversation?.chat_id ??
    activeConversation?.chatId ??
    active ??
    null;
  const showHandoffBanner = React.useMemo(() => {
    if (!activeConversationId) return false;
    const needsHuman = activeConversation?.needs_human && !activeConversation?.alert_sent;
    const pendingAlert = hasPendingAlert(pendingAlerts, activeConversationId);
    return Boolean(needsHuman || pendingAlert);
  }, [activeConversation, activeConversationId, pendingAlerts]);
  const handleAckAlert = React.useCallback(async () => {
    if (!activeConversationId || typeof ackAlert !== "function") return;
    await ackAlert(activeConversationId);
    const key = active || (typeof activeConversationId === "string" ? activeConversationId : null);
    if (key) {
      updateConv(key, (conv) => ({
        ...conv,
        alert_sent: true,
        needs_human: false,
      }));
    }
  }, [activeConversationId, ackAlert, active, updateConv]);

  const handleTranscribe = React.useCallback(
    async (chatId, message) => {
      if (!chatId || !message?.id) return;
      try {
        const { data } = await inboxApi.post("/ai/transcribe", { url: message.media?.url });
        updateConv(chatId, (conv) => ({
          ...conv,
          messages: conv.messages.map((item) =>
            item.id === message.id ? { ...item, transcript: data.text } : item
          ),
        }));
      } catch {}
    },
    [updateConv]
  );

  const handleAddTag = React.useCallback(
    async (chatId, tag) => {
      const trimmed = tag?.trim();
      if (!chatId || !trimmed) return;
      const contactId = convs.get(chatId)?.contact?.id;
      if (!contactId) return;
      try {
        const { data } = await inboxApi.post("/crm/tags", { id: contactId, tag: trimmed });
        setContactForChat(chatId, data.contact);
      } catch {}
    },
    [convs, setContactForChat]
  );

  return (
    <div
      className="grid grid-cols-[18rem,1fr,20rem] h-[600px] border rounded overflow-hidden relative"
      data-testid="wa-inbox"
    >
      <ConversationList
        convs={convs}
        active={active}
        onOpen={openChat}
        tagFilter={tagFilter}
        onTagFilter={setTagFilter}
        onAddTag={handleAddTag}
        pendingAlerts={pendingAlerts}
      />
      <ChatWindow
        conv={activeConversation}
        onSend={sendText}
        onSendMedia={sendMedia}
        onTyping={setTyping}
        onTranscribe={(message) => handleTranscribe(active, message)}
        showHandoff={showHandoffBanner}
        onAck={handleAckAlert}
      />
      <div className="border-l flex flex-col">
        <div className="p-2 border-b">
          <AIToggles chatId={active || ""} />
        </div>
        {active ? (
          <ContactPanel
            phone={active}
            name={convs.get(active)?.title || active}
            contact={convs.get(active)?.contact || null}
            onContactLoaded={(contact) => setContactForChat(active, contact)}
          />
        ) : (
          <div className="p-3 text-sm opacity-70">Abra uma conversa para ver o cliente.</div>
        )}
      </div>
      {process?.env?.NODE_ENV !== "production" && (
        <div className="absolute bottom-2 right-2 text-xs">
          <a href="/settings/governanca">Governança &amp; Logs</a>
        </div>
      )}
    </div>
  );
}
