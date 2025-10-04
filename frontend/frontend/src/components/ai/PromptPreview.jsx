import React, { useMemo, useState } from "react";
import PropTypes from "prop-types";
import { Button } from "@/ui/controls/Input.jsx";

function buildPreviewText({ vertical, brandVoice, languages, rag, guardrails }) {
  const segments = [];
  segments.push(`Segmento: ${vertical || "—"}`);
  segments.push(`Tom da marca: ${brandVoice || "—"}`);
  const langs = Array.isArray(languages) && languages.length > 0 ? languages.join(", ") : "—";
  segments.push(`Idiomas suportados: ${langs}`);
  const ragStatus = rag?.enabled ? `Ativado (topK=${rag?.topK ?? "—"})` : "Desativado";
  segments.push(`RAG: ${ragStatus}`);
  if (guardrails?.maxReplyChars) {
    segments.push(`Resposta limitada a ${guardrails.maxReplyChars} caracteres`);
  }
  if (Array.isArray(guardrails?.pre) && guardrails.pre.length > 0) {
    const topics = guardrails.pre
      .filter((rule) => rule?.type === "blockTopic" && rule?.value)
      .map((rule) => `- ${rule.value}`);
    if (topics.length) {
      segments.push("Bloquear tópicos:");
      segments.push(...topics);
    }
  }
  if (Array.isArray(guardrails?.post) && guardrails.post.length > 0) {
    guardrails.post.forEach((rule) => {
      if (rule?.type === "maxLength" && rule?.limit) {
        segments.push(`Checar limite pós-resposta: ${rule.limit} caracteres`);
      }
    });
  }
  return segments.join("\n");
}

export default function PromptPreview({ profile = {}, title = "Preview do Prompt" }) {
  const [copied, setCopied] = useState(false);
  const preview = useMemo(() => buildPreviewText(profile || {}), [profile]);

  const handleCopy = async () => {
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(preview);
      } else {
        const textarea = document.createElement("textarea");
        textarea.value = preview;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      setCopied(false);
    }
  };

  return (
    <section className="ui-card p-6 space-y-4" data-testid="prompt-preview">
      <header className="flex items-start justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
          <p className="text-sm text-slate-500">
            Consulte um resumo do prompt composto a partir das configurações atuais.
          </p>
        </div>
        <Button type="button" onClick={handleCopy} aria-live="polite">
          {copied ? "Copiado!" : "Copiar"}
        </Button>
      </header>

      <details className="rounded border border-slate-200">
        <summary className="cursor-pointer select-none px-4 py-3 text-sm font-medium text-slate-800">
          Ver prompt
        </summary>
        <pre className="overflow-x-auto bg-slate-900 px-4 py-4 text-xs text-slate-100">
{preview}
        </pre>
      </details>
    </section>
  );
}

PromptPreview.propTypes = {
  profile: PropTypes.shape({
    vertical: PropTypes.string,
    brandVoice: PropTypes.string,
    languages: PropTypes.arrayOf(PropTypes.string),
    rag: PropTypes.object,
    guardrails: PropTypes.object,
  }),
  title: PropTypes.string,
};

