import React, { useEffect, useState } from "react";
import inboxApi from "../api/inboxApi";
import { startSocketsSafe } from "../debug/installDebug";

// Página simples de atendimento com 3 colunas
export default function AtendimentoPage() {
  const [filter, setFilter] = useState("pendente");
  const [conversations, setConversations] = useState([]);
  const [active, setActive] = useState(null);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [socket, setSocket] = useState(null);

  // Conecta ao socket
  useEffect(() => {
    const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
    if (!token) {
      setSocket(null);
      return () => {};
    }
    const instance = startSocketsSafe({ auth: { token } });
    if (!instance) {
      setSocket(null);
      return () => {};
    }
    const handleMessage = (msg) => {
      if (active && msg.conversation_id === active.id) {
        setMessages((prev) => [...prev, msg]);
      }
    };
    instance.on("message:new", handleMessage);
    setSocket(instance);
    return () => {
      instance.off?.("message:new", handleMessage);
      try { instance.disconnect(); } catch {}
    };
  }, [active]);

  // Junta-se à sala da conversa selecionada
  useEffect(() => {
    if (socket && active) {
      socket.emit("join:conversation", active.id);
    }
  }, [socket, active]);

  // Carrega conversas de acordo com o filtro
  useEffect(() => {
    const load = async () => {
      try {
        const qs = filter === "pendente" ? "?status=pendente" : "?assigned_to=me";
        const { data } = await inboxApi.get(`/api/conversations${qs}`);
        setConversations(Array.isArray(data) ? data : []);
      } catch {
        setConversations([]);
      }
    };
    load();
  }, [filter]);

  // Carrega mensagens da conversa ativa
  useEffect(() => {
    if (!active) return setMessages([]);
    const load = async () => {
      try {
        const { data } = await inboxApi.get(`/api/conversations/${active.id}/messages`);
        setMessages(Array.isArray(data) ? data : []);
      } catch {
        setMessages([]);
      }
    };
    load();
  }, [active]);

  const enviarMensagem = async () => {
    if (!active || !text.trim()) return;
    try {
      const { data } = await inboxApi.post(`/api/conversations/${active.id}/messages`, { content: text });
      setText("");
      setMessages((prev) => [...prev, data]);
    } catch {}
  };

  const assumir = async () => {
    if (!active) return;
    try {
      await inboxApi.put(`/conversations/${active.id}/assumir`);
      setFilter("minhas");
    } catch {}
  };

  const encerrar = async () => {
    if (!active) return;
    try {
      await inboxApi.put(`/conversations/${active.id}/encerrar`);
      setActive(null);
      setFilter("pendente");
    } catch {}
  };

  return (
    <div className="flex h-full">
      {/* Coluna de conversas */}
      <div className="w-1/4 border-r p-4">
        <div className="mb-4 space-x-2">
          <button
            className={`px-2 py-1 border ${filter === "pendente" ? "bg-gray-200" : ""}`}
            onClick={() => setFilter("pendente")}
          >
            Pendente
          </button>
          <button
            className={`px-2 py-1 border ${filter === "minhas" ? "bg-gray-200" : ""}`}
            onClick={() => setFilter("minhas")}
          >
            Minhas
          </button>
        </div>
        <div className="space-y-2 overflow-y-auto" style={{ maxHeight: "calc(100% - 60px)" }}>
          {conversations.map((c) => (
            <div
              key={c.id}
              onClick={() => setActive(c)}
              className={`p-2 border rounded cursor-pointer ${active?.id === c.id ? "bg-blue-100" : ""}`}
            >
              <div className="text-sm">Conversa #{c.id}</div>
              <div className="text-xs text-gray-600">{c.status}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Coluna do chat */}
      <div className="flex-1 border-r flex flex-col">
        <div className="p-2 border-b space-x-2">
          <button className="px-2 py-1 border" onClick={assumir}>Assumir</button>
          <button className="px-2 py-1 border" onClick={() => alert("Transferir simulado")}>Transferir</button>
          <button className="px-2 py-1 border" onClick={encerrar}>Encerrar</button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {messages.map((m) => (
            <div key={m.id} className="text-sm">
              <strong>{m.sender}:</strong> {m.content}
            </div>
          ))}
        </div>
        <div className="p-2 border-t flex">
          <input
            className="flex-1 border p-2"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Digite uma mensagem"
          />
          <button className="ml-2 px-4 py-2 bg-blue-500 text-white" onClick={enviarMensagem}>
            Enviar
          </button>
        </div>
      </div>

      {/* Coluna do cliente */}
      <div className="w-1/4 p-4">
        <h2 className="font-bold mb-2">Cliente</h2>
        {active ? (
          <div className="text-sm space-y-1">
            <div>ID Cliente: {active.client_id ?? "n/d"}</div>
            <div>Status: {active.status}</div>
            <div>Canal: {active.canal}</div>
            <div>Atendente: {active.assigned_to || "-"}</div>
          </div>
        ) : (
          <p className="text-sm text-gray-600">Nenhuma conversa selecionada</p>
        )}
      </div>
    </div>
  );
}



