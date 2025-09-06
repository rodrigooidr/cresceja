// src/components/settings/WhatsAppBaileysCard.jsx
import React, { useEffect, useState } from "react";
import { makeSocket } from "../../sockets/socket";
import {
  startWaSession,
  getWaSessionStatus,
  logoutWaSession,
} from "../../api/integrations.service";

export default function WhatsAppBaileysCard({ enabled }) {
  // ✅ Hooks SEMPRE no topo
  const [status, setStatus] = useState("idle"); // idle|connecting|connected|error
  const [qr, setQr] = useState(null);

  useEffect(() => {
    let alive = true;

    // Se não estiver habilitado, apenas não faz nada (mas o hook é chamado!)
    if (!enabled) return;

    const sock = makeSocket();
    sock.on("wa:qrcode", (code) => { if (alive) setQr(code); });

    async function boot() {
      try {
        const { data } = await getWaSessionStatus();
        if (!alive) return;
        setStatus(data?.status || "disconnected");
        if ((data?.status || "disconnected") === "disconnected") {
          await startWaSession();
        }
      } catch (err) {
        if (!alive) return;
        setStatus("error");
      }
    }

    boot();

    return () => {
      alive = false;
      sock.off("wa:qrcode");
      sock.close();
    };
  }, [enabled]);

  async function handleLogout() {
    await logoutWaSession();
    setStatus("disconnected");
    setQr(null);
  }

  // ✅ O retorno condicional pode vir AQUI (depois dos hooks)
  if (!enabled) {
    return (
      <div className="border rounded-xl p-4 bg-white">
        <p className="text-sm text-gray-600">WhatsApp via Baileys está desativado.</p>
      </div>
    );
  }

  return (
    <div className="border rounded-xl p-4 bg-white">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-sm">WhatsApp (Baileys)</h3>
        <StatusPill status={status} />
      </div>

      {status === "connecting" && (
        <p className="mt-2 text-sm text-gray-600">Aguardando pareamento…</p>
      )}

      {qr && (
        <div className="mt-3">
          <img
            src={qr}
            alt="QR Code"
            className="w-48 h-48 object-contain border rounded"
          />
          <p className="text-xs text-gray-500 mt-1">
            Escaneie o QR Code no WhatsApp para conectar.
          </p>
        </div>
      )}

      {status === "connected" && (
        <button
          className="mt-2 px-3 py-1 bg-red-600 text-white"
          onClick={handleLogout}
        >
          Logout
        </button>
      )}
    </div>
  );
}

function StatusPill({ status }) {
  const map = {
    idle: { label: "Inativo", cls: "bg-gray-100 text-gray-700" },
    connecting: { label: "Conectando", cls: "bg-yellow-100 text-yellow-700" },
    connected: { label: "Conectado", cls: "bg-green-100 text-green-700" },
    error: { label: "Erro", cls: "bg-red-100 text-red-700" },
  };
  const s = map[status] || map.idle;
  return (
    <span className={`px-2 py-0.5 rounded text-xs border ${s.cls}`}>
      {s.label}
    </span>
  );
}
