// src/pages/inbox/components/ConversationList.jsx
import React, { useMemo } from "react";
import UrgentBadge from "./UrgentBadge.jsx";

const EMPTY_MAP = new Map();

/**
 * Props:
 * - loading: boolean
 * - items: Array<{
 *     id: string|number,
 *     client_name?: string,
 *     client?: { name?: string },
 *     channel?: string,             // whatsapp | instagram | facebook | email | ...
 *     tags?: string[],
 *     unread_count?: number,
 *     last_message_text?: string,
 *     last_message_at?: string|number|Date,
 *   }>
 * - selectedId: string|number|null
 * - onSelect: (id) => void
 */
export default function ConversationList({
  loading = false,
  items = [],
  selectedId,
  onSelect,
  pendingAlerts = EMPTY_MAP,
}) {
  const content = useMemo(() => {
    if (loading) return <SkeletonList />;
    if (!items.length) return <EmptyState />;

    return (
      <ul className="divide-y">
        {items.map((c) => (
          <Row
            key={c.id}
            item={c}
            selected={String(c.id) === String(selectedId)}
            onClick={() => onSelect?.(c.id)}
            pendingAlerts={pendingAlerts}
          />
        ))}
      </ul>
    );
  }, [loading, items, selectedId, onSelect, pendingAlerts]);

  return (
    <div className="h-full overflow-auto" data-testid="conv-list" aria-label="Conversations">
      <div data-testid="virt-top-sentinel" style={{ position:'absolute', top:0, height:1, width:1, opacity:0 }} />
      {content}
      <div data-testid="virt-bottom-sentinel" style={{ position:'absolute', bottom:0, height:1, width:1, opacity:0 }} />
    </div>
  );
}

function Row({ item, selected, onClick, pendingAlerts = EMPTY_MAP }) {
  const name =
    item.name ||
    item.contact?.name ||
    item.contact_name ||
    item.display_name ||
    item.client_name ||
    item.client?.name ||
    item.phone ||
    "Cliente";

  const lastText = item.last_message_text || "—";
  const ts = item.last_message_at ? formatTime(item.last_message_at) : "";

  const unread = Number(item.unread_count || 0);
  const channel = (item.channel || "—").toLowerCase();
  const conversationId = item.conversation_id ?? item.id ?? item.chat_id;
  const key = conversationId != null ? String(conversationId) : null;
  const needsHuman = item.needs_human && !item.alert_sent;
  const alsoPending = key
    ? pendingAlerts?.has?.(conversationId) || pendingAlerts?.has?.(key)
    : false;
  const showUrgent = Boolean(needsHuman || alsoPending);

  return (
    <li
      data-testid={`conv-item-${item.id}`}
      className={`p-3 cursor-pointer hover:bg-gray-50 ${
        selected ? "bg-blue-50" : "bg-white"
      }`}
      onClick={onClick}
    >
      <div className="flex items-start gap-3">
        <Avatar name={name} channel={channel} />

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <h4 className="font-medium text-sm truncate">
              {name}
              {showUrgent && <UrgentBadge />}
            </h4>
            <span className="text-[11px] text-gray-500 shrink-0">{ts}</span>
          </div>

          <p className="text-xs text-gray-600 truncate mt-0.5">{lastText}</p>

          <div className="mt-2 flex items-center gap-2">
            <ChannelPill channel={channel} />
            {!!(item.tags && item.tags.length) && (
              <div className="flex flex-wrap gap-1">
                {item.tags.slice(0, 3).map((t) => (
                  <span
                    key={t}
                    className="px-1.5 py-0.5 rounded-md border text-[10px] bg-gray-50"
                  >
                    {t}
                  </span>
                ))}
                {item.tags.length > 3 && (
                  <span className="text-[10px] text-gray-500">
                    +{item.tags.length - 3}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        {unread > 0 && (
          <span className="ml-1 min-w-5 h-5 px-1 rounded-full bg-blue-600 text-white text-[11px] flex items-center justify-center">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </div>
    </li>
  );
}

function Avatar({ name = "", channel = "" }) {
  const initials = getInitials(name);
  const emoji = channelEmoji(channel);
  return (
    <div
      className="w-9 h-9 rounded-full border flex items-center justify-center bg-white text-xs font-semibold"
      title={name}
    >
      <span className="mr-0.5">{emoji}</span>
      {initials}
    </div>
  );
}

function ChannelPill({ channel = "" }) {
  const label = channelLabel(channel);
  return (
    <span className="px-2 py-0.5 rounded-md text-[10px] border bg-white text-gray-700">
      {label}
    </span>
  );
}

function SkeletonList() {
  return (
    <ul className="divide-y animate-pulse" data-testid="conv-skeleton">
      {Array.from({ length: 8 }).map((_, i) => (
        <li key={i} className="p-3">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-full bg-gray-200" />
            <div className="flex-1 min-w-0">
              <div className="h-3 w-2/3 bg-gray-200 rounded" />
              <div className="h-3 w-5/6 bg-gray-200 rounded mt-2" />
              <div className="h-3 w-1/3 bg-gray-200 rounded mt-2" />
            </div>
            <div className="w-8 h-5 bg-gray-200 rounded-full" />
          </div>
        </li>
      ))}
    </ul>
  );
}

function EmptyState() {
  return (
    <div className="h-full flex items-center justify-center p-6 text-center" data-testid="conv-empty">
      <div>
        <div className="text-3xl mb-2">💬</div>
        <p className="text-sm text-gray-600">
          Nenhuma conversa encontrada.
        </p>
        <p className="text-xs text-gray-500">Ajuste os filtros ou inicie um novo atendimento.</p>
      </div>
    </div>
  );
}

// ------------------ utils ------------------

function getInitials(name = "") {
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map(p => p[0]?.toUpperCase() || "").join("");
}

function channelEmoji(ch) {
  switch (ch) {
    case "whatsapp": return "🟢";
    case "instagram": return "🟣";
    case "facebook": return "🔵";
    case "email": return "✉️";
    default: return "💠";
  }
}

function channelLabel(ch) {
  if (!ch) return "Canal";
  return ch[0].toUpperCase() + ch.slice(1);
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

    if (sameDay) {
      return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    }
    return d.toLocaleDateString();
  } catch {
    return "";
  }
}
