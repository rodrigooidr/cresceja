// src/pages/inbox/components/MessageComposer.jsx
import React, { useCallback, useRef, useState } from "react";

export default function MessageComposer({ onSend }) {
  const [text, setText] = useState("");
  const [files, setFiles] = useState([]);
  const [isSending, setIsSending] = useState(false);

  const fileInputRef = useRef(null);
  const dropRef = useRef(null);

  // ---------------------------
  // Util: adiciona arquivos
  // ---------------------------
  const addFiles = useCallback((fileList) => {
    if (!fileList || !fileList.length) return;
    const next = Array.from(fileList);

    // Evita duplicados por nome+size (heurística simples)
    setFiles((prev) => {
      const map = new Map(prev.map((f) => [f.name + ":" + f.size, f]));
      next.forEach((f) => {
        const key = f.name + ":" + f.size;
        if (!map.has(key)) map.set(key, f);
      });
      return Array.from(map.values());
    });
  }, []);

  // ---------------------------
  // Input de arquivos
  // ---------------------------
  const handleFileChange = (e) => addFiles(e.target.files);

  // ---------------------------
  // Paste de imagens/arquivos
  // ---------------------------
  const handlePaste = (e) => {
    if (!e.clipboardData) return;
    const items = e.clipboardData.items;
    const pastedFiles = [];
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      if (it.kind === "file") {
        const file = it.getAsFile();
        if (file && file.size > 0) pastedFiles.push(file);
      }
    }
    if (pastedFiles.length) addFiles(pastedFiles);
  };

  // ---------------------------
  // Drag & drop
  // ---------------------------
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
    addFiles(e.dataTransfer.files);
  };

  // ---------------------------
  // Remover um arquivo
  // ---------------------------
  const removeFile = (name, size) => {
    setFiles((prev) => prev.filter((f) => !(f.name === name && f.size === size)));
  };

  // ---------------------------
  // Enviar
  // ---------------------------
  const doSend = async () => {
    if (isSending) return;
    const trimmed = text.trim();
    const hasFiles = files.length > 0;

    if (!trimmed && !hasFiles) return;
    setIsSending(true);
    try {
      await onSend?.({ text: trimmed, files });
      setText("");
      setFiles([]);
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
      {/* Área de anexos selecionados */}
      {files.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-2">
          {files.map((f) => (
            <div
              key={f.name + ":" + f.size}
              className="flex items-center gap-2 px-2 py-1 border rounded-lg text-xs bg-gray-50"
              title={`${f.name} (${Math.round(f.size / 1024)} KB)`}
            >
              <span className="truncate max-w-[180px]">{f.name}</span>
              <button
                type="button"
                className="px-1 py-0.5 border rounded hover:bg-gray-100"
                onClick={() => removeFile(f.name, f.size)}
                aria-label={`Remover ${f.name}`}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

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
        <div className="flex items-center gap-2">
          {/* Emoji simples (lista mínima para não depender de libs externas) */}
          <details className="relative">
            <summary className="list-none px-3 py-2 border rounded-lg bg-white cursor-pointer select-none">
              😊
            </summary>
            <div className="absolute right-0 z-10 mt-2 w-44 border rounded-lg bg-white p-2 shadow">
              <div className="grid grid-cols-6 gap-1 text-lg">
                {["😀","😁","😂","🤣","😊","😍","😘","😎","😅","🤔","🙌","👍","👏","🔥","✨","💬","📎","✅"].map((e) => (
                  <button
                    key={e}
                    type="button"
                    className="hover:bg-gray-100 rounded"
                    onClick={() => setText((t) => t + e)}
                  >
                    {e}
                  </button>
                ))}
              </div>
            </div>
          </details>

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
            // Ajuste os tipos conforme sua necessidade
            accept="
              image/*,
              video/*,
              application/pdf,
              application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,
              application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,
              application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation,
              text/plain
            "
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
