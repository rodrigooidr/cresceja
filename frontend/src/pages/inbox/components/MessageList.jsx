// src/pages/inbox/components/MessageList.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import inboxApi from "api/inboxApi";
import MessageItem from "./MessageItem";
import { normalizeDirection } from "inbox/message.helpers";

export default function MessageList({ loading, messages = [], conversation }) {
  const scrollRef = useRef(null);

  const indexed = useMemo(() => {
    const arr = (Array.isArray(messages) ? [...messages] : []).sort((a, b) => {
      const ta = new Date(a.created_at).getTime() || 0;
      const tb = new Date(b.created_at).getTime() || 0;
      return ta - tb;
    });
    return arr.map((m, i) => ({ ...m, __idx: i }));
  }, [messages]);

  const [seen, setSeen] = useState({ in: new Set(), out: new Set() });
  const prevConvIdRef = useRef(null);

  useEffect(() => {
    const cid = conversation?.id ?? null;
    const changed = prevConvIdRef.current !== cid;
    if (!cid) return;
    if (changed) {
      prevConvIdRef.current = cid;
      const seenIn = new Set();
      const seenOut = new Set();
      for (const m of indexed) {
        const dir = normalizeDirection(m.direction) === "out" ? "out" : "in";
        const id = m.id ?? `${m.created_at}-${m.__idx}`;
        if (dir === "in") seenIn.add(id);
        else seenOut.add(id);
      }
      setSeen({ in: seenIn, out: seenOut });
    }
  }, [conversation?.id, indexed]);

  const firstUnseen = useMemo(() => {
    const res = { in: null, out: null };
    for (const m of indexed) {
      const dir = normalizeDirection(m.direction) === "out" ? "out" : "in";
      const id = m.id ?? `${m.created_at}-${m.__idx}`;
      if (!seen[dir].has(id)) {
        if (res[dir] == null) res[dir] = m.__idx;
      }
    }
    return res;
  }, [indexed, seen]);

  const groups = useMemo(() => {
    const map = new Map();
    for (const m of indexed) {
      const d = toLocalDate(m.created_at);
      const key = toKey(d);
      if (!map.has(key)) {
        map.set(key, { label: dayLabel(d), items: [] });
      }
      map.get(key).items.push(m);
    }
    return Array.from(map.entries()).map(([key, value]) => ({ key, ...value }));
  }, [indexed]);

  const ioRef = useRef(null);
  const nodeMapRef = useRef(new Map());

  const pendingInboundRef = useRef(new Set());
  const debounceTimerRef = useRef(null);

  const flushRead = async () => {
    if (!conversation?.id) return;
    const ids = Array.from(pendingInboundRef.current);
    if (!ids.length) return;

    const inboundMsgs = ids
      .map((id) => indexed.find((m) => (m.id ?? `${m.created_at}-${m.__idx}`) === id))
      .filter(Boolean)
      .sort((a, b) => a.__idx - b.__idx);

    const last = inboundMsgs[inboundMsgs.length - 1];
    if (!last) return;

    try {
      await inboxApi.put(`/inbox/conversations/${conversation.id}/read`, {
        up_to_id: last.id ?? `${last.created_at}-${last.__idx}`,
      });
    } catch {
      try {
        await inboxApi.put(`/inbox/conversations/${conversation.id}/read`, {
          message_ids: inboundMsgs.map((m) => m.id ?? `${m.created_at}-${m.__idx}`),
        });
      } catch (err2) {
        console.warn("Falha ao marcar como lidas (fallback ids):", err2);
      }
    } finally {
      pendingInboundRef.current.clear();
    }
  };

  const scheduleFlush = () => {
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(flushRead, 300);
  };

  useEffect(() => {
    if (ioRef.current) ioRef.current.disconnect();
    const io = new IntersectionObserver(
      (entries) => {
        const updates = { in: null, out: null };
        let touchedInbound = false;

        for (const entry of entries) {
          if (entry.isIntersecting && entry.intersectionRatio >= 0.6) {
            const { msgId, dir } = entry.target.dataset;
            if (!msgId || !dir) continue;

            if (!seen[dir].has(msgId)) {
              if (!updates[dir]) updates[dir] = new Set(seen[dir]);
              updates[dir].add(msgId);

              if (dir === "in") {
                pendingInboundRef.current.add(msgId);
                touchedInbound = true;
              }
            }
          }
        }

        if (updates.in || updates.out) {
          setSeen((prev) => ({
            in: updates.in ? updates.in : prev.in,
            out: updates.out ? updates.out : prev.out,
          }));
        }
        if (touchedInbound) scheduleFlush();
      },
      { threshold: [0, 0.6, 1] }
    );
    ioRef.current = io;

    for (const [, el] of nodeMapRef.current) {
      if (el) io.observe(el);
    }
    return () => io.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seen, conversation?.id, indexed.length]);

  const registerRef = (msg, el) => {
    const id = msg.id ?? `${msg.created_at}-${msg.__idx}`;
    if (!id) return;
    const dir = normalizeDirection(msg.direction) === "out" ? "out" : "in";

    if (el) {
      el.dataset.msgId = String(id);
      el.dataset.dir = dir;
    }
    const prevEl = nodeMapRef.current.get(id);
    if (prevEl && ioRef.current) ioRef.current.unobserve(prevEl);

    if (el) {
      nodeMapRef.current.set(id, el);
      if (ioRef.current) ioRef.current.observe(el);
    } else {
      nodeMapRef.current.delete(id);
    }
  };

  const content = useMemo(() => {
    if (loading) return <Skeleton />;
    if (!conversation) return <EmptyState kind="no-conv" />;
    if (!groups.length) return <EmptyState kind="no-msgs" />;

    return (
      <div className="p-3 space-y-4">
        {groups.map((g) => (
          <div key={g.key} className="space-y-2">
            <DayDivider label={g.label} />
            {g.items.map((m) => {
              const dir = normalizeDirection(m.direction) === "out" ? "out" : "in";
              const nodes = [];

              if (firstUnseen[dir] != null && m.__idx === firstUnseen[dir]) {
                nodes.push(
                  <NewMarker
                    key={`marker-${dir}-${m.__idx}`}
                    dir={dir}
                    conversation={conversation}
                  />
                );
              }

              nodes.push(
                <MessageItem
                  key={m.id ?? `${m.created_at}-${m.__idx}`}
                  msg={m}
                  registerRef={(el) => registerRef(m, el)}
                />
              );

              return <React.Fragment key={`wrap-${m.id ?? m.__idx}`}>{nodes}</React.Fragment>;
            })}
          </div>
        ))}
        <div id="end-anchor" />
      </div>
    );
  }, [loading, conversation, groups, firstUnseen]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const anchor = el.querySelector("#end-anchor");
    if (anchor?.scrollIntoView) anchor.scrollIntoView({ block: "end" });
    else el.scrollTop = el.scrollHeight;
  }, [indexed.length, loading]);

  return (
    <div ref={scrollRef} className="h-full overflow-auto">
      {content}
    </div>
  );
}

function DayDivider({ label }) {
  return (
    <div className="flex items-center gap-3 my-2">
      <div className="h-px bg-gray-200 flex-1" />
      <span className="text-[11px] text-gray-600 whitespace-nowrap">{label}</span>
      <div className="h-px bg-gray-200 flex-1" />
    </div>
  );
}

function NewMarker({ dir, conversation }) {
  const isIn = dir === "in";
  const who = isIn
    ? (conversation?.client_name || conversation?.client?.name || "cliente")
    : "você";
  const label = isIn ? `Novas de ${who}` : "Novas suas";
  return (
    <div className="flex items-center gap-3 my-1">
      <div className="h-px bg-blue-200 flex-1" />
      <span className="text-[11px] text-blue-700 font-medium bg-blue-50 border border-blue-200 rounded-full px-3 py-0.5">
        {label}
      </span>
      <div className="h-px bg-blue-200 flex-1" />
    </div>
  );
}

function Skeleton() {
  return (
    <div className="p-3 space-y-3 animate-pulse">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className={`flex ${i % 2 ? "items-end" : "items-start"}`}>
          <div className={`max-w-[75%] h-14 ${i % 2 ? "bg-blue-200" : "bg-gray-200"} rounded-2xl`} />
        </div>
      ))}
    </div>
  );
}

function EmptyState({ kind }) {
  const map = {
    "no-conv": {
      emoji: "👈",
      title: "Selecione uma conversa",
      desc: "Escolha uma conversa na lista à esquerda para começar.",
    },
    "no-msgs": {
      emoji: "💬",
      title: "Sem mensagens ainda",
      desc: "Envie a primeira mensagem usando o campo abaixo.",
    },
  };
  const c = map[kind] || map["no-msgs"];
  return (
    <div className="h-full flex items-center justify-center text-center p-6">
      <div>
        <div className="text-3xl mb-2">{c.emoji}</div>
        <p className="text-sm text-gray-700 font-medium">{c.title}</p>
        <p className="text-xs text-gray-500">{c.desc}</p>
      </div>
    </div>
  );
}

function toLocalDate(input) {
  const d = input instanceof Date ? input : new Date(input);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}
function toKey(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
function dayLabel(d) {
  const today = toLocalDate(new Date());
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (toKey(d) === toKey(today)) return "Hoje";
  if (toKey(d) === toKey(yesterday)) return "Ontem";
  return d.toLocaleDateString("pt-BR");
}
