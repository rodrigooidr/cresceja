// src/pages/inbox/components/MessageItem.jsx
import React from "react";

export default function MessageItem({ msg, registerRef }) {
  const isMine = !!msg.isMine;
  const align = isMine ? "items-end" : "items-start";
  const bubble =
    "max-w-[75%] px-3 py-2 rounded-2xl text-sm break-words " +
    (isMine
      ? "bg-blue-600 text-white rounded-tr-sm"
      : "bg-gray-100 text-gray-900 rounded-tl-sm");

  return (
    <div className={`w-full flex ${align}`} ref={registerRef}>
      <div className="flex flex-col gap-1">
        <div className={bubble}>{renderMessageBody(msg)}</div>
        <div className={`text-[10px] text-gray-500 ${isMine ? "text-right" : "text-left"}`}>
          <span>{formatTime(msg.created_at)}</span>
          {isMine && msg.status && <span> • {statusLabel(msg.status)}</span>}
        </div>
      </div>
    </div>
  );
}

function renderMessageBody(m) {
  if (Array.isArray(m.attachments) && m.attachments.length) {
    return (
      <div className="flex flex-col gap-2">
        {m.attachments.map((att) =>
          att.mime && att.mime.startsWith("image/") ? (
            <a
              key={att.id}
              href={att.url}
              target="_blank"
              rel="noopener"
            >
              <img
                src={att.thumb_url || att.url}
                alt={att.filename || "imagem"}
                className="rounded-md max-h-72 object-contain"
              />
            </a>
          ) : (
            <a
              key={att.id}
              href={att.url}
              target="_blank"
              rel="noopener"
              className="inline-flex items-center gap-2 px-2 py-1 rounded-md bg-white text-blue-700 border"
              title="Abrir/baixar arquivo"
            >
              📎<span className="truncate max-w-[220px]">{att.filename || "arquivo"}</span>
            </a>
          )
        )}
        {m.text && <p>{m.text}</p>}
      </div>
    );
  }

  if (m.type === "image" && m.media_url) {
    return (
      <a href={m.media_url} target="_blank" rel="noopener" className="block" title="Abrir imagem">
        <img src={m.media_url} alt={m.file_name || "imagem"} className="rounded-md max-h-72 object-contain" />
        {m.text && <p className="mt-2">{m.text}</p>}
      </a>
    );
  }

  if (m.type === "file" && m.media_url) {
    const label = m.file_name || "arquivo";
    return (
      <div>
        <p className="mb-2">{m.text || "Arquivo:"}</p>
        <a
          href={m.media_url}
          target="_blank"
          rel="noopener"
          className="inline-flex items-center gap-2 px-2 py-1 rounded-md bg-white text-blue-700 border"
          title="Abrir/baixar arquivo"
        >
          📎 <span className="truncate max-w-[220px]">{label}</span>
        </a>
      </div>
    );
  }

  return <span style={{ whiteSpace: "pre-wrap" }}>{m.text || " "}</span>;
}

// utils
function statusLabel(s = "") {
  switch (s) {
    case "sent": return "Enviada";
    case "delivered": return "Entregue";
    case "read": return "Lida";
    case "failed": return "Falhou";
    default: return "";
  }
}
function formatTime(input) {
  try {
    const d = input instanceof Date ? input : new Date(input);
    if (Number.isNaN(d.getTime())) return "";
    const now = new Date();
    const sameDay =
      d.getFullYear() === now.getFullYear() &&
      d.getMonth() === now.getMonth() &&
      d.getDate() === now.getDate();
    if (sameDay) return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    return d.toLocaleDateString();
  } catch {
    return "";
  }
}
