import React, { useState } from "react";
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
  },
  {
    key: "instagram",
    label: "Instagram",
    steps: [
      "Autorize o acesso à sua conta Instagram Business.",
      "Selecione a página do Facebook vinculada.",
      "Envie uma mensagem pelo direct para testar.",
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
  },
];

export default function AdminIntegrations() {
  const [tab, setTab] = useState("whatsapp");
  const [status, setStatus] = useState({});

  const current = TABS.find((t) => t.key === tab) || TABS[0];

  const test = async (k) => {
    try {
      await api.get(`/api/integrations/${k}/status`);
      setStatus((s) => ({ ...s, [k]: "ok" }));
    } catch {
      setStatus((s) => ({ ...s, [k]: "erro" }));
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
      <ol className="list-decimal ml-5 space-y-2 mb-4">
        {current.steps.map((s, i) => (
          <li key={i}>{s}</li>
        ))}
      </ol>
      <button
        onClick={() => test(current.key)}
        className="px-4 py-2 bg-blue-600 text-white rounded-lg"
      >
        Testar configuração
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
