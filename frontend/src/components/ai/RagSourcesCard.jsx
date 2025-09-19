import React, { useMemo, useState } from "react";
import PropTypes from "prop-types";
import inboxApi from "@/api/inboxApi.js";
import { Button, Input } from "@/ui/controls/Input.jsx";
import { useToasts } from "@/components/ToastHost.jsx";

function classNames(...parts) {
  return parts.filter(Boolean).join(" ");
}

export default function RagSourcesCard({
  orgId = null,
  disabled = false,
  className = "",
  onIngested,
}) {
  const { addToast } = useToasts();
  const [urlDraft, setUrlDraft] = useState("");
  const [uploading, setUploading] = useState(false);
  const [reindexing, setReindexing] = useState(false);
  const [status, setStatus] = useState({ type: "idle", message: "" });

  const isDisabled = disabled || !orgId;
  const srMessage = useMemo(() => status.message, [status]);

  const setStatusMessage = (type, message) => {
    setStatus({ type, message });
  };

  const resetStatus = () => setStatus({ type: "idle", message: "" });

  const handleUpload = async (file) => {
    if (!file || !orgId) return;
    setUploading(true);
    setStatusMessage("loading", "Enviando arquivo para a base de conhecimento");
    try {
      const form = new FormData();
      form.append("file", file);
      await inboxApi.post(`/orgs/${orgId}/kb/ingest`, form, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      addToast("Arquivo enviado com sucesso.");
      setStatusMessage("success", `Arquivo ${file.name} enviado`);
      if (typeof onIngested === "function") onIngested({ type: "file", name: file.name });
    } catch (error) {
      addToast("Falha ao enviar o arquivo.");
      setStatusMessage("error", "Não foi possível processar o arquivo");
    } finally {
      setUploading(false);
    }
  };

  const handleUrlSubmit = async () => {
    const url = urlDraft.trim();
    if (!url || !orgId) return;
    setStatusMessage("loading", "Enviando URL para a base de conhecimento");
    setUploading(true);
    try {
      await inboxApi.post(`/orgs/${orgId}/kb/ingest`, { url });
      addToast("URL enviada com sucesso.");
      setStatusMessage("success", "URL adicionada para ingestão");
      setUrlDraft("");
      if (typeof onIngested === "function") onIngested({ type: "url", value: url });
    } catch (error) {
      addToast("Falha ao enviar a URL.");
      setStatusMessage("error", "Não foi possível adicionar a URL");
    } finally {
      setUploading(false);
    }
  };

  const handleReindex = async () => {
    if (!orgId) return;
    setReindexing(true);
    setStatusMessage("loading", "Reindexando documentos");
    try {
      await inboxApi.post(`/orgs/${orgId}/kb/reindex`);
      addToast("Reindexação iniciada.");
      setStatusMessage("success", "Reindexação solicitada com sucesso");
    } catch (error) {
      addToast("Falha ao reindexar.");
      setStatusMessage("error", "Não foi possível reindexar a base");
    } finally {
      setReindexing(false);
    }
  };

  return (
    <section
      className={classNames("ui-card p-6 space-y-4", className)}
      data-testid="rag-card"
    >
      <div className="sr-only" aria-live="polite" role="status">
        {srMessage}
      </div>

      <header className="space-y-1">
        <h2 className="text-lg font-semibold text-slate-900">Fontes do RAG</h2>
        <p className="text-sm text-slate-500">
          Carregue documentos ou URLs que alimentam a base de conhecimento usada pela IA.
        </p>
      </header>

      <div className="space-y-3">
        <label className="text-sm font-medium text-slate-700" htmlFor="rag-upload-input">
          Upload de arquivo
        </label>
        <input
          id="rag-upload-input"
          type="file"
          className="w-full rounded border border-dashed border-slate-300 p-3 text-sm"
          onChange={(event) => {
            const [file] = Array.from(event.target.files || []);
            if (file) handleUpload(file);
            event.target.value = "";
          }}
          disabled={isDisabled || uploading}
          aria-disabled={isDisabled || uploading || undefined}
        />
        <p className="text-xs text-slate-500">
          Aceita PDF, TXT e planilhas. O conteúdo será indexado para buscas semânticas.
        </p>
      </div>

      <div className="space-y-2">
        <label
          className="text-sm font-medium text-slate-700"
          htmlFor="rag-url-input"
        >
          Adicionar URL
        </label>
        <Input
          id="rag-url-input"
          type="url"
          placeholder="https://exemplo.com/base-de-conhecimento"
          value={urlDraft}
          onChange={(event) => setUrlDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              handleUrlSubmit();
            }
          }}
          disabled={isDisabled || uploading}
          aria-disabled={isDisabled || uploading || undefined}
        />
        <div className="flex justify-end">
          <Button
            type="button"
            variant="primary"
            onClick={handleUrlSubmit}
            disabled={isDisabled || uploading || !urlDraft.trim()}
            aria-disabled={isDisabled || uploading || !urlDraft.trim() || undefined}
          >
            Enviar URL
          </Button>
        </div>
      </div>

      <div className="flex items-center justify-between rounded border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
        <div>
          <p className="font-medium text-slate-800">Sincronizar novamente</p>
          <p className="text-xs text-slate-500">
            Solicite uma nova indexação para incorporar mudanças nos documentos.
          </p>
        </div>
        <Button
          type="button"
          onClick={handleReindex}
          disabled={isDisabled || reindexing}
          aria-disabled={isDisabled || reindexing || undefined}
        >
          {reindexing ? "Reindexando…" : "Reindexar"}
        </Button>
      </div>

      {status.type === "error" && (
        <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">
          {status.message}
        </div>
      )}

      {status.type === "success" && (
        <div className="rounded border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
          {status.message}
        </div>
      )}

      {status.type === "idle" && status.message && (
        <p className="text-xs text-slate-500">{status.message}</p>
      )}

      {status.type === "loading" && (
        <div className="rounded border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
          {status.message}
        </div>
      )}

      {status.type !== "loading" && status.message && (
        <button
          type="button"
          className="text-xs text-slate-400 hover:text-slate-500"
          onClick={resetStatus}
        >
          Limpar mensagem
        </button>
      )}
    </section>
  );
}

RagSourcesCard.propTypes = {
  orgId: PropTypes.string,
  disabled: PropTypes.bool,
  className: PropTypes.string,
  onIngested: PropTypes.func,
};

