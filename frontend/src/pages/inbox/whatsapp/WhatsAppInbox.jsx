import React from "react";
import { createWhatsAppClient } from "../../../integrations/whatsapp/client";

function useWhatsAppClient({ transport = "cloud" } = {}) {
  const [client, setClient] = React.useState(null);
  React.useEffect(() => {
    const c = createWhatsAppClient({ transport });
    setClient(c);
    return () => {
      // nada a desmontar no client atual
    };
  }, [transport]);
  return client;
}

function useConversations(client) {
  const [convs, setConvs] = React.useState(new Map()); // chatId -> {id,title,messages,unread,typing}
  const [active, setActive] = React.useState(null);

  // helper para imutabilidade leve
  const updateConv = React.useCallback((chatId, fn) => {
    setConvs((prev) => {
      const next = new Map(prev);
      const base =
        next.get(chatId) || { id: chatId, title: chatId, messages: [], unread: 0, typing: "paused" };
      next.set(chatId, fn(base));
      return next;
    });
  }, []);

  React.useEffect(() => {
    if (!client) return;
    const offMsg = client.on("message", (m) => {
      updateConv(m.chatId, (c) => {
        const exists = c.messages.some((x) => x.id === m.id);
        const msgs = exists
          ? c.messages.map((x) => (x.id === m.id ? { ...x, ...m } : x))
          : [...c.messages, m];
        const unread = exists
          ? c.unread
          : active === m.chatId && m.direction === "in"
            ? c.unread
            : c.unread + (m.direction === "in" ? 1 : 0);
        return { ...c, messages: msgs, unread };
      });
      // Se a conversa está ativa e chegou msg IN, marca como lida
      if (active === m.chatId && m.direction === "in") {
        client.markRead({ chatId: m.chatId, messageId: m.id }).catch(() => {});
      }
    });
    const offSt = client.on("status", (s) => {
      updateConv(s.chatId, (c) => {
        const msgs = c.messages.map((x) => (x.id === s.messageId ? { ...x, status: s.status } : x));
        return { ...c, messages: msgs };
      });
    });
    const offTy = client.on("typing", (t) => {
      updateConv(t.chatId, (c) => ({ ...c, typing: t.state }));
    });
    return () => {
      offMsg?.();
      offSt?.();
      offTy?.();
    };
  }, [client, active, updateConv]);

  const openChat = React.useCallback(
    async (chatId) => {
      if (!client) return;
      setActive(chatId);
      // carrega histórico (append no topo se quiser paginação; aqui simples)
      const hist = await client.fetchHistory({ chatId, limit: 30 });
      setConvs((prev) => {
        const next = new Map(prev);
        const base =
          next.get(chatId) || { id: chatId, title: chatId, messages: [], unread: 0, typing: "paused" };
        // evita duplicar pelo id
        const ids = new Set(base.messages.map((m) => m.id));
        const merged = [...hist.items.filter((m) => !ids.has(m.id)), ...base.messages];
        next.set(chatId, { ...base, messages: merged, unread: 0 });
        return next;
      });
      // marca última como lida
      const lastIn = hist.items.filter((m) => m.direction === "in").slice(-1)[0];
      if (lastIn) client.markRead({ chatId, messageId: lastIn.id }).catch(() => {});
    },
    [client]
  );

  const sendText = React.useCallback(
    async (chatId, text) => {
      if (!client) return;
      const tmpId = `tmp-${Math.random().toString(36).slice(2)}`;
      // otimista
      updateConv(chatId, (c) => ({
        ...c,
        messages: [
          ...c.messages,
          {
            id: tmpId,
            chatId,
            from: "me",
            to: chatId,
            direction: "out",
            type: "text",
            text,
            timestamp: Date.now(),
            status: "queued",
          },
        ],
      }));
      try {
        const msg = await client.sendText({ to: chatId, text, chatId });
        updateConv(chatId, (c) => ({
          ...c,
          messages: c.messages.map((m) => (m.id === tmpId ? msg : m)),
        }));
      } catch (e) {
        updateConv(chatId, (c) => ({
          ...c,
          messages: c.messages.map((m) => (m.id === tmpId ? { ...m, status: "failed" } : m)),
        }));
      }
    },
    [client, updateConv]
  );

  const sendMedia = React.useCallback(
    async (chatId, media, caption) => {
      if (!client) return;
      const tmpId = `tmp-${Math.random().toString(36).slice(2)}`;
      updateConv(chatId, (c) => ({
        ...c,
        messages: [
          ...c.messages,
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
        updateConv(chatId, (c) => ({
          ...c,
          messages: c.messages.map((m) => (m.id === tmpId ? msg : m)),
        }));
      } catch {
        updateConv(chatId, (c) => ({
          ...c,
          messages: c.messages.map((m) => (m.id === tmpId ? { ...m, status: "failed" } : m)),
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

  return { convs, active, openChat, sendText, sendMedia, setTyping };
}

function ConversationList({ convs, active, onOpen }) {
  const list = React.useMemo(
    () =>
      Array.from(convs.values()).sort((a, b) => {
        const ta = a.messages.slice(-1)[0]?.timestamp || 0;
        const tb = b.messages.slice(-1)[0]?.timestamp || 0;
        return tb - ta;
      }),
    [convs]
  );
  return (
    <div className="w-64 border-r overflow-auto" role="navigation" aria-label="Conversas">
      {list.length === 0 && <div className="p-3 text-sm opacity-70">Sem conversas.</div>}
      {list.map((c) => (
        <button
          key={c.id}
          onClick={() => onOpen(c.id)}
          className={`w-full text-left p-3 border-b ${active === c.id ? "bg-gray-100" : ""}`}
          data-testid={`conv-${c.id}`}
        >
          <div className="font-medium">{c.title}</div>
          <div className="text-xs opacity-70 truncate">
            {c.messages.slice(-1)[0]?.text || c.messages.slice(-1)[0]?.type}
          </div>
          {c.unread > 0 && (
            <span className="inline-block mt-1 text-[10px] bg-blue-600 text-white px-1.5 rounded">
              {c.unread}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

function MessageBubble({ m }) {
  const mine = m.direction === "out";
  return (
    <div className={`flex ${mine ? "justify-end" : "justify-start"} my-1`}>
      <div className={`max-w-[70%] rounded-xl p-2 text-sm shadow ${mine ? "bg-blue-50" : "bg-white"}`}>
        {m.type === "text" ? (
          <div>{m.text}</div>
        ) : m.media?.type?.startsWith("image") ? (
          <figure>
            <img
              alt={m.media?.filename || "imagem"}
              src={m.media?.url}
              style={{ maxWidth: 240, borderRadius: 8 }}
            />
            {m.text && <figcaption className="text-xs mt-1 opacity-70">{m.text}</figcaption>}
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

function ChatWindow({ conv, onSend, onSendMedia, onTyping }) {
  const [text, setText] = React.useState("");
  const [mediaUrl, setMediaUrl] = React.useState("");

  React.useEffect(() => setText(""), [conv?.id]);

  return (
    <div className="flex-1 flex flex-col h-full">
      <div className="flex items-center justify-between p-3 border-b">
        <div>
          <div className="font-semibold">{conv?.title || "Selecione uma conversa"}</div>
          {conv?.typing === "composing" && (
            <div className="text-xs text-green-600" data-testid="typing">
              digitando…
            </div>
          )}
        </div>
      </div>
      <div className="flex-1 p-3 overflow-auto" role="log" aria-live="polite">
        {!conv && <div className="opacity-70 text-sm">Nenhuma conversa aberta.</div>}
        {conv && conv.messages.map((m) => <MessageBubble key={m.id} m={m} />)}
      </div>
      {conv && (
        <div className="p-3 border-t space-y-2">
          <div className="flex gap-2">
            <input
              placeholder="URL de imagem (opcional)"
              value={mediaUrl}
              onChange={(e) => setMediaUrl(e.target.value)}
              className="flex-1 border px-2 py-1 text-sm"
              data-testid="media-url"
            />
            <button
              onClick={() =>
                mediaUrl && onSendMedia(conv.id, { type: "image/png", url: mediaUrl, mime: "image/png" }, "")
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
              onChange={(e) => {
                setText(e.target.value);
                onTyping(conv.id, e.target.value ? "composing" : "paused");
              }}
              className="flex-1 border px-2 py-1 text-sm"
              rows={2}
              data-testid="composer"
            />
            <button
              onClick={() => {
                if (text.trim()) {
                  onSend(conv.id, text.trim());
                  setText("");
                  onTyping(conv.id, "paused");
                }
              }}
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
  const { convs, active, openChat, sendText, sendMedia, setTyping } = useConversations(client);

  // seed opcional: se não houver conversas, mostra uma para demo ao montar (não afeta prod)
  React.useEffect(() => {
    if (!client) return;
    // nada por padrão; testes injetam via mock
  }, [client]);

  return (
    <div className="flex h-[600px] border rounded overflow-hidden" data-testid="wa-inbox">
      <ConversationList convs={convs} active={active} onOpen={openChat} />
      <ChatWindow conv={active ? convs.get(active) : null} onSend={sendText} onSendMedia={sendMedia} onTyping={setTyping} />
    </div>
  );
}
