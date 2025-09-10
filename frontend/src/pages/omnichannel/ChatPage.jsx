import inboxApi from "../../api/inboxApi";
// src/pages/Omnichannel/ChatPage.jsx
// Omnichannel Chat — pronto para uso
// - 3 colunas: Inbox/Filas | Thread/Composer | Painel do Cliente
// - Integra Socket.io (auth por JWT) e REST (fallbacks se API indisponível)
// - Links e ações básicas: assumir conversa, enviar mensagem, filtros, busca

import React, { useEffect, useMemo, useRef, useState } from "react";
import { io } from "socket.io-client";
import inboxApi from "../../api/inboxApi";

const CHANNEL_ICONS = {
  whatsapp: "/icons/whatsapp.svg",
  instagram: "/icons/instagram.svg",
  facebook: "/icons/facebook.svg",
};
const DEFAULT_AVATAR = "/icons/default-avatar.svg";

/** Utilidades **/
const fmtTime = (ts) => {
  try {
    const d = typeof ts === "number" ? new Date(ts) : new Date(ts || Date.now());
    return d.toLocaleString();
  } catch {
    return "";
  }
};

const classNames = (...xs) => xs.filter(Boolean).join(" ");

const useLocalToken = () => {
  const [token] = useState(() => localStorage.getItem("token") || "");
  return token;
};

/** Dados de exemplo (fallback quando API não responde) **/
const SAMPLE_CONVERSATIONS = [
  {
    id: "conv-demo-1",
    channel: "whatsapp",
    title: "Maria Souza",
    lastMessage: "Oi! Quero saber mais do plano Pro",
    updatedAt: Date.now() - 1000 * 60 * 5,
    status: "pendente",
    priority: "normal",
    assignee: null,
    contact: {
      id: "c1",
      name: "Maria Souza",
      email: "maria@exemplo.com",
      phone: "+55 41 99999-9999",
    },
  },
  {
    id: "conv-demo-2",
    channel: "instagram",
    title: "@joaodasilva",
    lastMessage: "Como funciona a integração com WhatsApp?",
    updatedAt: Date.now() - 1000 * 60 * 32,
    status: "em_andamento",
    priority: "alto",
    assignee: "you",
    contact: {
      id: "c2",
      name: "João da Silva",
      email: "joao@exemplo.com",
      phone: "",
    },
  },
];

const SAMPLE_MESSAGES = {
  "conv-demo-1": [
    { id: "m1", from: "contact", text: "Oi! Quero saber mais do plano Pro", at: Date.now() - 1000 * 60 * 8 },
  ],
  "conv-demo-2": [
    { id: "m2", from: "contact", text: "Como funciona a integração com WhatsApp?", at: Date.now() - 1000 * 60 * 35 },
    { id: "m3", from: "agent", text: "Oi João! A integração é direta e você mantém seu número.", at: Date.now() - 1000 * 60 * 30 },
  ],
};

function playBeep(freq = 440, duration = 0.2) {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    setTimeout(() => {
      osc.stop();
      ctx.close();
    }, duration * 1000);
  } catch {}
}

/** Templates WhatsApp (mock) **/
const WA_TEMPLATES = [
  { id: "boas_vindas", name: "Boas-vindas", body: "Olá {{nome}}, aqui é da CresceJá! Posso ajudar?" },
  { id: "followup", name: "Follow-up", body: "Oi {{nome}}, passando para saber se deu certo. Precisa de algo?" },
];

export default function ChatPage() {
  const token = useLocalToken();
  const [socket, setSocket] = useState(null);
  const [actingUser, setActingUser] = useState(() => localStorage.getItem("actingUser") || "self");

  // Inbox
  const [conversations, setConversations] = useState([]);
  const [statusFilter, setStatusFilter] = useState("todas");
  const [channelFilter, setChannelFilter] = useState("todos");
  const [search, setSearch] = useState("");

  // Seleção
  const [activeId, setActiveId] = useState(null);

  // Thread
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [quickReplies, setQuickReplies] = useState([]);
  const [aiActive, setAiActive] = useState(true);
  const [needsHuman, setNeedsHuman] = useState(false);

  const threadBottomRef = useRef(null);

  useEffect(() => {
    const handler = () => setActingUser(localStorage.getItem("actingUser") || "self");
    window.addEventListener("acting-user-changed", handler);
    return () => window.removeEventListener("acting-user-changed", handler);
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await inboxApi.get('/quick-replies');
        setQuickReplies(Array.isArray(data?.templates) ? data.templates : []);
      } catch {}
    })();
  }, []);

  /** Socket setup **/
  useEffect(() => {
    if (!token) return;
    const url = (process.env.REACT_APP_WS_URL || process.env.REACT_APP_API_URL || "http://localhost:4000").replace(/^http/, "ws");

    const s = io(url, {
      transports: ["websocket"],
      auth: { token },
    });

    s.on("connect", () => {
      // console.log("WS connected", s.id);
      if (activeId) s.emit("join:conversation", activeId);
    });

    s.on("chat:message", (msg) => {
      // Recebe mensagem em tempo real da conversa ativa
      setMessages((prev) => {
        if (!activeId || msg?.conversationId !== activeId) return prev;
        return [...prev, { id: `ws-${Date.now()}`, from: msg.from === "system" ? "system" : msg.from === "agent" ? "agent" : "contact", text: msg.text, at: msg.at }];
      });
      playBeep();
    });

    setSocket(s);
    return () => s.disconnect();
  }, [token, activeId]);

  /** Carregar conversas (REST com fallback) **/
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const qs = [];
        if (statusFilter !== "todas") qs.push(`status=${encodeURIComponent(statusFilter)}`);
        if (channelFilter !== "todos") qs.push(`channel=${encodeURIComponent(channelFilter)}`);
        if (search) qs.push(`q=${encodeURIComponent(search)}`);
        const url = `/conversations${qs.length ? `?${qs.join("&")}` : ""}`;
        const { data } = await inboxApi.get(url);
        if (!mounted) return;
        setConversations(Array.isArray(data) ? data : []);
      } catch {
        if (!mounted) return;
        // fallback demo
        let list = SAMPLE_CONVERSATIONS;
        if (statusFilter !== "todas") list = list.filter((c) => c.status === statusFilter);
        if (channelFilter !== "todos") list = list.filter((c) => c.channel === channelFilter);
        if (search) list = list.filter((c) => (c.title || "").toLowerCase().includes(search.toLowerCase()));
        setConversations(list);
      }
    })();
    return () => { mounted = false; };
  }, [statusFilter, channelFilter, search, actingUser]);

  /** Carregar mensagens da conversa ativa (REST com fallback) **/
  useEffect(() => {
    if (!activeId) return setMessages([]);
    let mounted = true;
    (async () => {
      try {
        const { data } = await inboxApi.get(`/api/conversations/${activeId}/messages`);
        if (!mounted) return;
        const msgs = Array.isArray(data)
          ? data.map((m) => ({ id: m.id, from: m.from || (m.author_role === "agent" ? "agent" : "contact"), text: m.text, at: m.created_at || m.at }))
          : [];
        setMessages(msgs);
        socket?.emit("join:conversation", activeId);
      } catch {
        if (!mounted) return;
        setMessages(SAMPLE_MESSAGES[activeId] || []);
        socket?.emit("join:conversation", activeId);
      }
    })();
    return () => { mounted = false; };
  }, [activeId, socket, actingUser]);

  useEffect(() => {
    // auto-scroll bottom quando novas mensagens chegam
    threadBottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const filtered = useMemo(() => conversations, [conversations]);
  const activeConv = useMemo(
    () => filtered.find((c) => c.id === activeId),
    [filtered, activeId]
  );

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || !activeId) return;
    setSending(true);
    try {
      // Tenta via REST
      const payload = { text };
      const url = `/api/conversations/${activeId}/messages`;
      await inboxApi.post(url, payload);
      setMessages((prev) => [...prev, { id: `tmp-${Date.now()}`, from: "agent", text, at: Date.now() }]);
      setInput("");
    } catch {
      // Fallback: emite via WS
      socket?.emit("chat:message", { conversationId: activeId, text });
      setMessages((prev) => [...prev, { id: `tmp-${Date.now()}`, from: "agent", text, at: Date.now() }]);
      setInput("");
    } finally {
      setSending(false);
    }
  };

  const assumeConversation = async (id) => {
    try {
      await inboxApi.put(`/conversations/${id}/assumir`);
      setConversations((prev) => prev.map((c) => (c.id === id ? { ...c, assignee: "you", status: "em_andamento" } : c)));
    } catch {
      setConversations((prev) => prev.map((c) => (c.id === id ? { ...c, assignee: "you", status: "em_andamento" } : c)));
    }
  };

  const endConversation = async (id) => {
    try {
      await inboxApi.put(`/conversations/${id}/status`, { status: "resolvida" });
    } catch {}
    setConversations((prev) => prev.map((c) => (c.id === id ? { ...c, status: "resolvida" } : c)));
  };

  return (
    <div className="h-[calc(100vh-0px)] w-full grid grid-cols-1 md:grid-cols-10">
      {/* Coluna 1 — Inbox/Filas */}
      <aside className="md:col-span-3 border-r flex flex-col min-h-0">
        <div className="p-3 border-b">
          <div className="flex gap-2">
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="border rounded-lg px-2 py-1 text-sm">
              <option value="todas">Todas</option>
              <option value="pendente">Pendente</option>
              <option value="nao_atribuido">Não atribuído</option>
              <option value="em_andamento">Em andamento</option>
              <option value="resolvida">Resolvida</option>
            </select>
            <select value={channelFilter} onChange={(e) => setChannelFilter(e.target.value)} className="border rounded-lg px-2 py-1 text-sm">
              <option value="todos">Todos os canais</option>
              <option value="whatsapp">WhatsApp</option>
              <option value="instagram">Instagram</option>
              <option value="facebook">Facebook</option>
            </select>
          </div>
          <input
            className="mt-2 w-full border rounded-lg px-3 py-2 text-sm"
            placeholder="Buscar nome, número, e-mail..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="flex-1 overflow-auto">
          {filtered.length === 0 && (
            <div className="p-4 text-sm text-gray-500">Nenhuma conversa encontrada.</div>
          )}
          <ul>
            {filtered.map((c) => (
              <li
                key={c.id}
                className={classNames(
                  "px-3 py-2 border-b cursor-pointer hover:bg-gray-50",
                  activeId === c.id && "bg-blue-50"
                )}
                onClick={() => setActiveId(c.id)}
              >
                <div className="flex items-center gap-2">
                  <div className="relative w-10 h-10 shrink-0">
                    <img
                      src={c.contact?.photo || c.contact?.avatar || DEFAULT_AVATAR}
                      alt="avatar"
                      className="w-10 h-10 rounded-full object-cover"
                    />
                    {CHANNEL_ICONS[c.channel] && (
                      <img
                        src={CHANNEL_ICONS[c.channel]}
                        alt="canal"
                        className="absolute -bottom-1 -right-1 w-4 h-4"
                      />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <div className="font-medium truncate max-w-[70%]">
                        {c.title || c.contact?.name || c.id}
                      </div>
                      <div className="text-xs text-gray-500 ml-2">
                        {fmtTime(c.updatedAt)}
                      </div>
                    </div>
                    <div className="text-xs text-gray-500 truncate">
                      {c.lastMessage}
                    </div>
                    <div className="mt-1 flex items-center gap-2 text-[11px]">
                      <span
                        className={classNames(
                          "px-2 py-0.5 rounded-full",
                          c.status === "pendente" && "bg-amber-100 text-amber-700",
                          c.status === "em_andamento" && "bg-blue-100 text-blue-700",
                          c.status === "resolvida" && "bg-emerald-100 text-emerald-700"
                        )}
                      >
                        {c.status || ""}
                      </span>
                      {c.assignee ? (
                        <span className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-700">
                          atribuído
                        </span>
                      ) : (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            assumeConversation(c.id);
                          }}
                          className="text-xs px-2 py-0.5 rounded-full bg-blue-600 text-white hover:bg-blue-700"
                        >
                          Assumir
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </aside>

      {/* Coluna 2 — Thread/Composer */}
      <main className="md:col-span-4 flex flex-col min-h-0">
        {/* Header da conversa */}
        <div className="p-3 border-b flex items-center justify-between">
          <div className="flex items-center gap-2 font-semibold">
            {activeConv ? (
              <>
                <div className="relative w-8 h-8">
                  <img
                    src={activeConv.contact?.photo || activeConv.contact?.avatar || DEFAULT_AVATAR}
                    alt="avatar"
                    className="w-8 h-8 rounded-full object-cover"
                  />
                  {CHANNEL_ICONS[activeConv.channel] && (
                    <img
                      src={CHANNEL_ICONS[activeConv.channel]}
                      alt="canal"
                      className="absolute -bottom-1 -right-1 w-3 h-3"
                    />
                  )}
                </div>
                <span className="truncate">
                  {activeConv.title || activeConv.contact?.name || activeConv.id}
                </span>
              </>
            ) : (
              <span>Selecione uma conversa</span>
            )}
          </div>
          {activeId && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => endConversation(activeId)}
                className="px-3 py-1 text-sm rounded-lg border hover:bg-gray-50"
              >
                Encerrar
              </button>
            </div>
          )}
        </div>

        {/* Mensagens */}
        {needsHuman && (
          <div className="bg-red-600 text-white text-center text-sm py-2">
            Cliente solicitou atendente!
          </div>
        )}
        <div className="flex-1 overflow-auto p-4 space-y-2 bg-white">
          {!activeId && <div className="text-sm text-gray-500">Escolha uma conversa na lista à esquerda.</div>}
          {activeId && messages.map((m) => (
            <div
              key={m.id}
              className={classNames(
                "flex items-end gap-2",
                m.from === "agent" ? "justify-end" : ""
              )}
            >
              {m.from !== "agent" && (
                <img
                  src={activeConv?.contact?.photo || activeConv?.contact?.avatar || DEFAULT_AVATAR}
                  alt="avatar"
                  className="w-6 h-6 rounded-full object-cover"
                />
              )}
              <div
                className={classNames(
                  "max-w-[75%]",
                  m.from === "agent" ? "" : ""
                )}
              >
                <div
                  className={classNames(
                    "rounded-2xl px-3 py-2 shadow-sm border",
                    m.from === "agent"
                      ? "bg-blue-600 text-white border-blue-600"
                      : "bg-gray-50"
                  )}
                >
                  <div className="whitespace-pre-wrap text-sm">{m.text}</div>
                </div>
                <div
                  className={classNames(
                    "text-[11px] text-gray-500 mt-1",
                    m.from === "agent" ? "text-right" : ""
                  )}
                >
                  {fmtTime(m.at)}
                </div>
              </div>
            </div>
          ))}
          <div ref={threadBottomRef} />
        </div>

        {/* Composer */}
        <div className="border-t p-3 bg-white">
          <div className="flex items-center gap-2 mb-2">
            <TemplatesDropdown onPick={(t) => setInput((prev) => prev ? prev + "\n" + t.body : t.body)} />
            <QuickReplies list={quickReplies} onPick={(q) => setInput((prev) => prev ? prev + "\n" + q : q)} />
            {aiActive ? (
              <button onClick={() => setAiActive(false)} className="px-3 py-1.5 text-sm border rounded-lg hover:bg-gray-50">
                Parar IA
              </button>
            ) : (
              <span className="text-xs text-gray-500">IA pausada</span>
            )}
            <button
              onClick={() => { setNeedsHuman(true); playBeep(1000,0.5); }}
              className="px-3 py-1.5 text-sm border rounded-lg hover:bg-gray-50"
            >
              Falar com atendente
            </button>
          </div>
          <div className="flex items-end gap-2">
            <textarea
              rows={2}
              className="flex-1 border rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-200"
              placeholder={activeId ? "Escreva sua resposta..." : "Selecione uma conversa para responder"}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                  e.preventDefault();
                  sendMessage();
                }
              }}
              disabled={!activeId}
            />
            <button
              onClick={sendMessage}
              disabled={!activeId || sending || !input.trim()}
              className="px-4 py-2 rounded-xl bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60"
            >
              {sending ? "Enviando..." : "Enviar"}
            </button>
          </div>
          <div className="text-[11px] text-gray-500 mt-1">Dica: Ctrl+Enter envia</div>
        </div>
      </main>

      {/* Coluna 3 — Painel do Cliente/CRM */}
      <aside className="md:col-span-3 border-l flex flex-col min-h-0">
        <div className="p-3 border-b font-semibold">Cliente & CRM</div>
        <div className="p-3 space-y-3 overflow-auto">
          {!activeId && <div className="text-sm text-gray-500">Selecione uma conversa para ver os detalhes.</div>}
          {activeId && (
            <CustomerCard conv={filtered.find((c) => c.id === activeId)} />
          )}
        </div>
      </aside>
    </div>
  );
}

/** Componentes auxiliares **/
function TemplatesDropdown({ onPick }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button onClick={() => setOpen((v) => !v)} className="px-3 py-1.5 text-sm border rounded-lg hover:bg-gray-50">
        Templates
      </button>
      {open && (
        <div className="absolute z-10 mt-1 w-64 bg-white border rounded-lg shadow">
          {WA_TEMPLATES.map((t) => (
            <button
              key={t.id}
              onClick={() => { onPick(t); setOpen(false); }}
              className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50"
            >
              <div className="font-medium">{t.name}</div>
              <div className="text-xs text-gray-500 truncate">{t.body}</div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function QuickReplies({ list = [], onPick }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button onClick={() => setOpen((v) => !v)} className="px-3 py-1.5 text-sm border rounded-lg hover:bg-gray-50">
        Respostas rápidas
      </button>
      {open && (
        <div className="absolute z-10 mt-1 w-64 bg-white border rounded-lg shadow max-h-60 overflow-auto">
          {!list.length && (
            <div className="px-3 py-2 text-sm text-gray-500">Nenhuma</div>
          )}
          {list.map((q) => (
            <button
              key={q.id}
              onClick={() => {
                onPick(q.body);
                setOpen(false);
              }}
              className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50"
            >
              <div className="font-medium">{q.title}</div>
              <div className="text-xs text-gray-500 truncate">{q.body}</div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function CustomerCard({ conv }) {
  if (!conv) return null;
  const c = conv.contact || {};
  const fields = [
    { label: "Nome", value: c.name || conv.title || "-" },
    { label: "E-mail", value: c.email || "-" },
    { label: "WhatsApp", value: c.phone || "-" },
    { label: "Canal", value: conv.channel || "-" },
    { label: "Status", value: conv.status || "-" },
    { label: "Atualizado", value: fmtTime(conv.updatedAt) },
  ];

  return (
    <div className="border rounded-2xl p-4">
      <div className="font-semibold">Perfil</div>
      <div className="mt-2 grid grid-cols-1 gap-2 text-sm">
        {fields.map((f) => (
          <div key={f.label} className="flex items-center justify-between">
            <div className="text-gray-500">{f.label}</div>
            <div className="font-medium text-right ml-3 truncate max-w-[60%]">{f.value}</div>
          </div>
        ))}
      </div>

      <div className="mt-4 border-t pt-3">
        <div className="font-semibold">Ações rápidas</div>
        <div className="mt-2 flex flex-wrap gap-2">
          <button className="px-3 py-1.5 text-sm rounded-lg border hover:bg-gray-50">Criar oportunidade</button>
          <button className="px-3 py-1.5 text-sm rounded-lg border hover:bg-gray-50">Agendar follow-up</button>
          <button className="px-3 py-1.5 text-sm rounded-lg border hover:bg-gray-50">Aplicar tag</button>
        </div>
      </div>
    </div>
  );
}

