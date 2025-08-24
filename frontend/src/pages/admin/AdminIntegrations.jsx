import React, { useEffect, useState } from "react";
import api from "../../api/api";

const TABS = [
  {
    key: "whatsapp",
    label: "WhatsApp",
    steps: [
      "Clique em 'Conectar' e faça login com a conta desejada.",
      "Escaneie o QR Code exibido para vincular o número.",
      "Envie uma mensagem de teste para validar a integração.",
    ],
    images: [
      "https://via.placeholder.com/400x200?text=WhatsApp+1",
      "https://via.placeholder.com/400x200?text=WhatsApp+2",
      "https://via.placeholder.com/400x200?text=WhatsApp+3",
    ],
    fields: [
      { name: "phone", label: "Número", placeholder: "55XXXXXXXXX" },
      { name: "apiKey", label: "API Key", placeholder: "chave" },
    ],
  },
  {
    key: "instagram",
    label: "Instagram",
    steps: [
      "Autorize o acesso à sua conta Instagram Business.",
      "Selecione a página do Facebook vinculada.",
      "Envie uma mensagem pelo direct para testar.",
    ],
    images: [
      "https://via.placeholder.com/400x200?text=Instagram+1",
      "https://via.placeholder.com/400x200?text=Instagram+2",
      "https://via.placeholder.com/400x200?text=Instagram+3",
    ],
    fields: [
      { name: "appId", label: "App ID", placeholder: "ID do app" },
      { name: "appSecret", label: "App Secret", placeholder: "Segredo" },
    ],
  },
  {
    key: "facebook",
    label: "Facebook",
    steps: [
      "Conecte sua página do Facebook.",
      "Garanta as permissões de mensagens.",
      "Realize um envio de teste.",
    ],
    images: [
      "https://via.placeholder.com/400x200?text=Facebook+1",
      "https://via.placeholder.com/400x200?text=Facebook+2",
      "https://via.placeholder.com/400x200?text=Facebook+3",
    ],
    fields: [
      { name: "pageId", label: "Page ID", placeholder: "ID da página" },
      { name: "token", label: "Token", placeholder: "Token de acesso" },
    ],
  },
];

export default function AdminIntegrations() {
  const [tab, setTab] = useState("whatsapp");
  const [status, setStatus] = useState({});
  const [form, setForm] = useState({});

  const current = TABS.find((t) => t.key === tab) || TABS[0];

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const { data } = await api.get(`/api/integrations/${tab}/status`);
        if (alive) setForm(data?.integration?.config || {});
      } catch {
        if (alive) setForm({});
      }
    })();
    return () => {
      alive = false;
    };
  }, [tab]);

  const save = async () => {
    try {
      await api.post(`/api/integrations/${current.key}/connect`, { config: form });
      setStatus((s) => ({ ...s, [current.key]: "ok" }));
    } catch {
      setStatus((s) => ({ ...s, [current.key]: "erro" }));
    }
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Configurar Integrações</h1>
      <div className="flex gap-4 border-b mb-4">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`pb-2 ${tab === t.key ? "border-b-2 border-blue-600 font-semibold" : "text-gray-600"}`}
          >
            {t.label}
          </button>
        ))}
      </div>
      <ol className="list-decimal ml-5 space-y-4 mb-4">
        {current.steps.map((s, i) => (
          <li key={i}>
            <p>{s}</p>
            {current.images?.[i] && (
              <img
                src={current.images[i]}
                alt={`Passo ${i + 1}`}
                className="my-2 rounded border max-w-md"
              />
            )}
          </li>
        ))}
      </ol>
      <div className="grid gap-4 mb-4 max-w-md">
        {current.fields?.map((f) => (
          <div key={f.name} className="flex flex-col">
            <label className="text-sm text-gray-600 mb-1">{f.label}</label>
            <input
              type="text"
              value={form[f.name] || ""}
              onChange={(e) => setForm({ ...form, [f.name]: e.target.value })}
              placeholder={f.placeholder}
              className="border rounded px-2 py-1"
            />
          </div>
        ))}
      </div>
      <button
        onClick={save}
        className="px-4 py-2 bg-blue-600 text-white rounded-lg"
      >
        Salvar configuração
      </button>
      {status[current.key] === "ok" && (
        <div className="mt-3 text-green-700">Configuração verificada com sucesso!</div>
      )}
      {status[current.key] === "erro" && (
        <div className="mt-3 text-red-700">Falha ao verificar configuração.</div>
      )}
    </div>
  );
}
