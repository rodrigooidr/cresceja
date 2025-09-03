// src/pages/inbox/components/MessageComposer.jsx
import React, { useRef, useState } from "react";
import QuickReplyModal from "./QuickReplyModal.jsx";
import SnippetsPopover from "./SnippetsPopover.jsx";

function useOutsideClose(ref, onClose, deps = []) {
  React.useEffect(() => {
    function onDoc(e) {
      if (ref.current && !ref.current.contains(e.target)) onClose?.();
    }
    function onKey(ev) {
      if (ev.key === "Escape") onClose?.();
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

export default function MessageComposer({ onSend, sel, onFiles }) {
  const [text, setText] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [showEmoji, setShowEmoji] = useState(false);
  const [showQuick, setShowQuick] = useState(false);
  const [showSnippets, setShowSnippets] = useState(false);
  const [quickReplies] = useState([]);
  const [snippets] = useState([]);

  const fileInputRef = useRef(null);
  const dropRef = useRef(null);
  const emojiRef = useRef(null);
  const quickRef = useRef(null);
  const snippetsRef = useRef(null);

  useOutsideClose(emojiRef, () => setShowEmoji(false), [sel?.id]);
  useOutsideClose(quickRef, () => setShowQuick(false), [sel?.id]);
  useOutsideClose(snippetsRef, () => setShowSnippets(false), [sel?.id]);

  const onSelectQuick = (q) => {
    const content = q?.content || q?.text || "";
    setText((t) => (t ? `${t} ${content}` : content));
    setShowQuick(false);
  };
  const onPickSnippet = (s) => {
    const content = s?.content || "";
    setText((t) => (t ? `${t} ${content}` : content));
    setShowSnippets(false);
  };

  const handleFileChange = (e) => {
    onFiles?.(e.target.files);
    e.target.value = "";
  };

  const handlePaste = (e) => {
    const files = e.clipboardData?.files;
    if (files?.length) onFiles?.(files);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (dropRef.current) dropRef.current.classList.add("ring-2", "ring-blue-400");
  };
  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (dropRef.current) dropRef.current.classList.remove("ring-2", "ring-blue-400");
  };
  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (dropRef.current) dropRef.current.classList.remove("ring-2", "ring-blue-400");
    onFiles?.(e.dataTransfer.files);
  };

  // ---------------------------
  // Enviar
  // ---------------------------
  const doSend = async () => {
    if (isSending) return;
    const trimmed = text.trim();
    setIsSending(true);
    try {
      await onSend?.({ text: trimmed });
      setText("");
    } finally {
      setIsSending(false);
    }
  };

  // Enter envia; Shift+Enter quebra linha
  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      doSend();
    }
  };

  // ---------------------------
  // UI
  // ---------------------------
  return (
    <div
      className="message-composer w-full border rounded-xl bg-white shadow-sm p-2"
      onPaste={handlePaste}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      ref={dropRef}
    >
      {/* Editor + botões */}
      <div className="flex items-end gap-2">
        <textarea
          className="flex-1 resize-none px-3 py-2 border rounded-lg text-sm min-h-[44px] max-h-[200px] focus:outline-none focus:ring-2 focus:ring-blue-400"
          placeholder="Escreva uma mensagem… (Enter envia, Shift+Enter quebra linha)"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
        />

        {/* Botões de ação */}
        <div className="flex items-center gap-2 relative">
          <button
            type="button"
            className="px-3 py-2 border rounded-lg bg-white"
            onClick={() => setShowEmoji((v) => !v)}
            title="Emoji"
          >
            😊
          </button>
          {showEmoji && (
            <div
              ref={emojiRef}
              className="absolute bottom-12 right-0 z-20 mt-2 w-44 border rounded-lg bg-white p-2 shadow"
            >
              <div className="grid grid-cols-6 gap-1 text-lg">
                {["😀","😁","😂","🤣","😊","😍","😘","😎","😅","🤔","🙌","👍","👏","🔥","✨","💬","📎","✅"].map((e) => (
                  <button
                    key={e}
                    type="button"
                    className="hover:bg-gray-100 rounded"
                    onClick={() => {
                      setText((t) => t + e);
                      setShowEmoji(false);
                    }}
                  >
                    {e}
                  </button>
                ))}
              </div>
            </div>
          )}

          <button
            type="button"
            className="px-3 py-2 border rounded-lg bg-white"
            onClick={() => setShowQuick((v) => !v)}
            title="Respostas rápidas"
          >
            ⚡
          </button>
          {showQuick && (
            <div ref={quickRef} className="absolute bottom-12 right-12 z-20">
              <QuickReplyModal
                open
                onClose={() => setShowQuick(false)}
                quickReplies={quickReplies}
                onSelect={onSelectQuick}
              />
            </div>
          )}

          <button
            type="button"
            className="px-3 py-2 border rounded-lg bg-white"
            onClick={() => setShowSnippets((v) => !v)}
            title="Snippets"
          >
            📋
          </button>
          {showSnippets && (
            <div ref={snippetsRef} className="absolute bottom-12 left-0 z-20">
              <SnippetsPopover
                open
                onClose={() => setShowSnippets(false)}
                items={snippets}
                onPick={onPickSnippet}
              />
            </div>
          )}

          {/* Anexos */}
          <button
            type="button"
            className="px-3 py-2 border rounded-lg bg-white"
            onClick={() => fileInputRef.current?.click()}
            title="Anexar arquivo"
          >
            📎
          </button>
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            multiple
            onChange={handleFileChange}
            accept="image/*,video/*,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation,text/plain"
          />

          {/* Enviar */}
          <button
            type="button"
            className={`px-4 py-2 rounded-lg text-white ${
              isSending ? "bg-gray-400" : "bg-blue-600 hover:bg-blue-700"
            }`}
            onClick={doSend}
            disabled={isSending}
          >
            {isSending ? "Enviando..." : "Enviar"}
          </button>
        </div>
      </div>
    </div>
  );
}
