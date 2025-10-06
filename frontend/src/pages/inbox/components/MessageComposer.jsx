// src/pages/inbox/components/MessageComposer.jsx
import React, { useEffect, useRef, useState } from "react";
import PopoverPortal from "ui/PopoverPortal";
import QuickReplyModal from "./QuickReplyModal.jsx";
import { listTemplates, listQuickReplies, aiDraftMessage } from "../../../inbox/inbox.service";
import { getDraft, setDraft, clearDraft } from "../../../inbox/drafts.store";

function useOutsideClose(ref, onClose, deps = []) {
  useEffect(() => {
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

export default function MessageComposer({ onSend, sel, onFiles, disabled = false, disabledReason = '' }) {
  const convId = sel?.id || sel?.conversation_id || null;
  const orgId = sel?.org_id || sel?.orgId || sel?.organization_id || sel?.org?.id || null;

  const [text, setText] = useState("");
  const [isSending, setIsSending] = useState(false);

  const [showEmoji, setShowEmoji] = useState(false);
  const [showQuick, setShowQuick] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);

  const [quickReplies, setQuickReplies] = useState([]);
  const [aiLoading, setAiLoading] = useState(false);
  const [templates, setTemplates] = useState([]);
  const [loadingQuick, setLoadingQuick] = useState(false);
  const [loadingTemplates, setLoadingTemplates] = useState(false);

  const fileInputRef = useRef(null);
  const dropRef = useRef(null);

  // âncoras dos popovers
  const emojiBtnRef = useRef(null);
  const quickBtnRef = useRef(null);
  const templatesBtnRef = useRef(null);

  // nós internos (para outside click)
  const emojiRef = useRef(null);
  const quickRef = useRef(null);
  const templatesRef = useRef(null);

  useOutsideClose(emojiRef, () => setShowEmoji(false), [convId, showEmoji]);
  useOutsideClose(quickRef, () => setShowQuick(false), [convId, showQuick]);
  useOutsideClose(templatesRef, () => setShowTemplates(false), [convId, showTemplates]);

  // ---------- Helpers de rascunho ----------
  const setTextAndDraft = (valueOrUpdater) => {
    setText((prev) => {
      const next =
        typeof valueOrUpdater === "function" ? valueOrUpdater(prev) : valueOrUpdater;
      if (convId) setDraft(convId, next);
      return next;
    });
  };

  // Ao trocar de conversa: fecha popovers e carrega rascunho dessa conversa
  useEffect(() => {
    setShowEmoji(false);
    setShowQuick(false);
    setShowTemplates(false);
    setText(getDraft(convId) || "");
  }, [convId]);

  // Carregar templates e quick replies
  useEffect(() => {
    setLoadingTemplates(true);
    listTemplates(orgId ? { orgId } : {})
      .then((data) => {
        if (Array.isArray(data)) setTemplates(data);
      })
      .catch(() => {})
      .finally(() => setLoadingTemplates(false));

    setLoadingQuick(true);
    listQuickReplies()
      .then((data) => {
        if (Array.isArray(data)) setQuickReplies(data);
      })
      .catch(() => {})
      .finally(() => setLoadingQuick(false));
  }, [orgId]);

  // ---------- Quick replies / Templates / Emojis ----------
  const onSelectQuick = (q) => {
    const content = q?.content || q?.text || "";
    setTextAndDraft((t) => (t ? `${t} ${content}` : content));
    setShowQuick(false);
  };
  const onPickTemplate = (t) => {
    const content = t?.content || t?.text || "";
    setTextAndDraft((cur) => (cur ? `${cur} ${content}` : content));
    setShowTemplates(false);
  };

  const handleAIDraft = async () => {
    if (!convId || aiLoading) return;
    setAiLoading(true);
    try {
      const payload = { conversationId: convId, context: [] };
      const resp = await aiDraftMessage(payload);
      const draftText = resp?.draft?.text || resp?.draft || resp?.text || '';
      if (draftText) {
        setTextAndDraft(draftText);
      }
    } catch (err) {
      console.error('aiDraftMessage failed', err);
    } finally {
      setAiLoading(false);
    }
  };

  // ---------- Arquivos, paste e drag ----------
  const handleFiles = (fileList) => {
    const files = Array.from(fileList || []);
    if (onFiles) onFiles(fileList);
    files.forEach((f) => onSend?.({ file: f }));
  };
  const handleFileChange = (e) => {
    handleFiles(e.target.files);
    e.target.value = "";
  };
  const handlePaste = (e) => {
    const files = e.clipboardData?.files;
    if (files?.length) handleFiles(files);
  };
  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    dropRef.current?.classList.add("ring-2", "ring-blue-400");
  };
  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    dropRef.current?.classList.remove("ring-2", "ring-blue-400");
  };
  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    dropRef.current?.classList.remove("ring-2", "ring-blue-400");
    handleFiles(e.dataTransfer.files);
  };

  // ---------- Envio ----------
  const doSend = async () => {
    if (isSending || disabled) return;
    const trimmed = text.trim();
    if (!trimmed) return;
    setIsSending(true);
    try {
      await onSend?.({ text: trimmed });
      if (convId) clearDraft(convId);
      setText("");
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      doSend();
    }
  };

  const locked = Boolean(disabled);
  const sendDisabled = disabled || isSending || !text.trim();

  return (
    <div
      className="message-composer w-full border rounded-xl bg-white shadow-sm p-2"
      onPaste={handlePaste}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      ref={dropRef}
    >
      <div className="flex items-end gap-2">
        <textarea
          data-testid="composer-text"
          data-testid-alt="composer-textarea"
          className="flex-1 resize-none px-3 py-2 border rounded-lg text-sm min-h-[44px] max-h-[200px] focus:outline-none focus:ring-2 focus:ring-blue-400"
          placeholder="Escreva uma mensagem… (Enter envia, Shift+Enter quebra linha)"
          value={text}
          onChange={(e) => setTextAndDraft(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          title={disabled ? disabledReason : undefined}
        />

        <div className="flex items-center gap-2">
          {/* Emoji */}
          <button
            ref={emojiBtnRef}
            type="button"
            className="h-9 w-9 border rounded-lg bg-white grid place-items-center"
            onClick={() => setShowEmoji((v) => !v)}
            title="Emoji"
          >
            😊
          </button>
          <PopoverPortal anchorEl={emojiBtnRef.current} open={showEmoji} onClose={() => setShowEmoji(false)}>
            <div ref={emojiRef}>
              <div className="grid grid-cols-6 gap-1 text-lg">
                {["😀","😁","😂","🤣","😊","😍","😘","😎","😅","🤔","🙌","👍","👏","🔥","✨","💬","📎","✅"].map((e) => (
                  <button
                    key={e}
                    type="button"
                    className="hover:bg-gray-100 rounded"
                    onClick={() => {
                      setTextAndDraft((t) => t + e);
                      setShowEmoji(false);
                    }}
                  >
                    {e}
                  </button>
                ))}
              </div>
            </div>
          </PopoverPortal>

          {/* Respostas rápidas */}
          <button
            ref={quickBtnRef}
            type="button"
            data-testid="btn-quick-replies"
            className="h-9 w-9 border rounded-lg bg-white grid place-items-center"
            onClick={() => setShowQuick((v) => !v)}
            title="Respostas rápidas"
          >
            ⚡
          </button>
          <PopoverPortal anchorEl={quickBtnRef.current} open={showQuick} onClose={() => setShowQuick(false)}>
            <div ref={quickRef} className="max-h-72 overflow-auto" data-testid="quick-replies-portal">
              {loadingQuick ? (
                <div className="p-2 text-sm text-gray-500">Carregando...</div>
              ) : (
                <QuickReplyModal
                  open
                  onClose={() => setShowQuick(false)}
                  quickReplies={quickReplies}
                  onSelect={onSelectQuick}
                />
              )}
            </div>
          </PopoverPortal>

          {/* Templates */}
          <button
            ref={templatesBtnRef}
            type="button"
            data-testid="btn-templates"
            className="h-9 w-9 border rounded-lg bg-white grid place-items-center"
            onClick={() => setShowTemplates((v) => !v)}
            title="Templates"
          >
            📋
          </button>
          <PopoverPortal
            anchorEl={templatesBtnRef.current}
            open={showTemplates}
            onClose={() => setShowTemplates(false)}
          >
            <div ref={templatesRef} className="w-64 max-h-72 overflow-auto p-2" data-testid="templates-portal">
              {loadingTemplates ? (
                <div className="text-sm text-gray-500 px-2 py-1">Carregando...</div>
              ) : templates.length ? (
                templates.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    className="block w-full text-left px-2 py-1 text-sm hover:bg-gray-100 rounded-md"
                    onClick={() => onPickTemplate(t)}
                  >
                    <div className="font-medium truncate">{t.title}</div>
                    {t.text ? <div className="text-xs text-gray-500 truncate">{t.text}</div> : null}
                  </button>
                ))
              ) : (
                <div className="text-sm text-gray-500 px-2 py-1">Sem templates.</div>
              )}
            </div>
          </PopoverPortal>
          {/* IA Draft */}
          <button
            type="button"
            className="h-9 w-9 border rounded-lg bg-white grid place-items-center"
            onClick={handleAIDraft}
            disabled={!convId || aiLoading}
            title="IA → Gerar rascunho"
          >
            {aiLoading ? '…' : '🤖'}
          </button>

          {/* Anexos */}
          <button
            type="button"
            data-testid="btn-attach"
            className="h-9 w-9 border rounded-lg bg-white grid place-items-center"
            onClick={() => fileInputRef.current?.click()}
            title="Anexar arquivo"
          >
            📎
          </button>
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            data-testid="composer-file-input"
            data-testid-alt="file-input"
            multiple
            onChange={handleFileChange}
            accept="image/*,video/*,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation,text/plain"
          />

          {/* Enviar */}
          <button
            type="button"
            data-testid={locked ? "composer-locked" : "composer-send"}
            className={`px-4 py-2 rounded-lg text-white ${sendDisabled ? "bg-gray-400" : "bg-blue-600 hover:bg-blue-700"}`}
            onClick={doSend}
            disabled={sendDisabled}
            title={locked ? (disabledReason || "Respostas permitidas até 24h após a última mensagem") : undefined}
          >
            {isSending ? "Enviando..." : "Enviar"}
          </button>
        </div>
      </div>
    </div>
  );
}
