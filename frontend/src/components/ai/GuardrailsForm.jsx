import React, { useMemo, useState } from "react";
import PropTypes from "prop-types";
import { Button, Input } from "@/ui/controls/Input.jsx";
import Switch from "@/ui/controls/Switch.jsx";

const TOPIC_RULE = "blockTopic";
const MAX_LENGTH_RULE = "maxLength";

function normalizeGuardrails(value) {
  const guardrails = value && typeof value === "object" ? value : {};
  const pre = Array.isArray(guardrails.pre) ? guardrails.pre : [];
  const post = Array.isArray(guardrails.post) ? guardrails.post : [];
  return { ...guardrails, pre, post };
}

function ensureUniqueTerms(terms) {
  const seen = new Set();
  const list = [];
  for (const term of terms) {
    const key = term.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      list.push(term);
    }
  }
  return list;
}

export default function GuardrailsForm({
  value = { maxReplyChars: "", pre: [], post: [] },
  onChange,
  disabled = false,
}) {
  const guardrails = useMemo(() => normalizeGuardrails(value), [value]);
  const blockTopicRules = useMemo(
    () => guardrails.pre.filter((rule) => rule?.type === TOPIC_RULE),
    [guardrails.pre],
  );
  const blockTopicTerms = useMemo(
    () =>
      ensureUniqueTerms(
        blockTopicRules
          .map((rule) => (rule?.value != null ? String(rule.value) : ""))
          .filter(Boolean),
      ),
    [blockTopicRules],
  );
  const maxLengthRule = useMemo(
    () => guardrails.post.find((rule) => rule?.type === MAX_LENGTH_RULE) || null,
    [guardrails.post],
  );

  const [topicDraft, setTopicDraft] = useState("");
  const [maxLengthDraft, setMaxLengthDraft] = useState(() =>
    maxLengthRule?.limit != null ? String(maxLengthRule.limit) : "",
  );

  const [srMessage, setSrMessage] = useState("");

  const emitChange = (next) => {
    if (typeof onChange === "function") {
      onChange(normalizeGuardrails(next));
    }
  };

  const handleToggleBlockTopics = (enabled) => {
    const otherRules = guardrails.pre.filter((rule) => rule?.type !== TOPIC_RULE);
    if (!enabled) {
      emitChange({ ...guardrails, pre: otherRules });
      setSrMessage("Filtro de tópicos sensíveis desativado");
      return;
    }

    const baseTerms = blockTopicTerms.length > 0 ? blockTopicTerms : ["preço", "desconto"];
    const nextRules = [
      ...otherRules,
      ...baseTerms.map((term) => ({ type: TOPIC_RULE, value: term })),
    ];
    emitChange({ ...guardrails, pre: nextRules });
    setSrMessage("Filtro de tópicos sensíveis ativado");
  };

  const handleAddTopic = (event) => {
    event?.preventDefault?.();
    const raw = topicDraft.trim();
    if (!raw) return;
    if (blockTopicTerms.some((term) => term.toLowerCase() === raw.toLowerCase())) {
      setTopicDraft("");
      return;
    }
    const nextRules = [
      ...guardrails.pre.filter((rule) => rule?.type !== TOPIC_RULE),
      ...blockTopicTerms.map((term) => ({ type: TOPIC_RULE, value: term })),
      { type: TOPIC_RULE, value: raw },
    ];
    emitChange({ ...guardrails, pre: nextRules });
    setTopicDraft("");
    setSrMessage(`Tópico "${raw}" adicionado aos bloqueios`);
  };

  const handleRemoveTopic = (term) => {
    const lower = term.toLowerCase();
    const nextRules = guardrails.pre.filter((rule) => {
      if (rule?.type !== TOPIC_RULE) return true;
      const value = rule?.value != null ? String(rule.value).toLowerCase() : "";
      return value !== lower;
    });
    emitChange({ ...guardrails, pre: nextRules });
    setSrMessage(`Tópico "${term}" removido dos bloqueios`);
  };

  const handleMaxLengthToggle = (enabled) => {
    const others = guardrails.post.filter((rule) => rule?.type !== MAX_LENGTH_RULE);
    if (!enabled) {
      emitChange({ ...guardrails, post: others });
      setMaxLengthDraft("");
      setSrMessage("Limite de tamanho de resposta desativado");
      return;
    }
    const limit = maxLengthDraft && Number.parseInt(maxLengthDraft, 10) > 0
      ? Number.parseInt(maxLengthDraft, 10)
      : 600;
    setMaxLengthDraft(String(limit));
    emitChange({ ...guardrails, post: [...others, { type: MAX_LENGTH_RULE, limit }] });
    setSrMessage("Limite de tamanho de resposta ativado");
  };

  const handleMaxLengthChange = (event) => {
    const { value } = event.target;
    setMaxLengthDraft(value);
    const parsed = Number.parseInt(value, 10);
    const others = guardrails.post.filter((rule) => rule?.type !== MAX_LENGTH_RULE);
    if (Number.isFinite(parsed) && parsed > 0) {
      emitChange({ ...guardrails, post: [...others, { type: MAX_LENGTH_RULE, limit: parsed }] });
    } else {
      emitChange({ ...guardrails, post: others });
    }
  };

  const handleMaxReplyChange = (event) => {
    const { value } = event.target;
    emitChange({ ...guardrails, maxReplyChars: value });
  };

  const blockTopicsEnabled = blockTopicTerms.length > 0;
  const maxLengthEnabled = guardrails.post.some((rule) => rule?.type === MAX_LENGTH_RULE);

  return (
    <section className="ui-card p-6 space-y-5" data-testid="guardrails-form">
      <div className="sr-only" aria-live="polite" role="status">
        {srMessage}
      </div>

      <header className="space-y-1">
        <h2 className="text-lg font-semibold text-slate-900">Guardrails</h2>
        <p className="text-sm text-slate-500">
          Limite respostas e defina filtros de segurança para proteger o atendimento.
        </p>
      </header>

      <div className="space-y-2">
        <label htmlFor="guardrails-max-reply" className="text-sm font-medium text-slate-700">
          Tamanho máximo da resposta (caracteres)
        </label>
        <Input
          id="guardrails-max-reply"
          type="number"
          min="50"
          step="10"
          value={guardrails.maxReplyChars ?? ""}
          onChange={handleMaxReplyChange}
          disabled={disabled}
          aria-disabled={disabled || undefined}
        />
        <p className="text-xs text-slate-500">
          Deixe em branco para permitir respostas completas. Ajuste conforme o canal e o contexto.
        </p>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between gap-4">
          <div>
            <label
              htmlFor="guardrails-block-topics"
              className="text-sm font-medium text-slate-800"
            >
              Bloquear tópicos sensíveis
            </label>
            <p className="text-xs text-slate-500">
              Interrompe mensagens que mencionem termos críticos (ex.: pedidos de desconto).
            </p>
          </div>
          <Switch
            id="guardrails-block-topics"
            checked={blockTopicsEnabled}
            onChange={handleToggleBlockTopics}
            disabled={disabled}
            aria-disabled={disabled || undefined}
          />
        </div>

        {blockTopicsEnabled && (
          <div className="space-y-2">
            <form className="flex gap-2" onSubmit={handleAddTopic}>
              <label htmlFor="guardrails-topic-input" className="sr-only">
                Novo termo para bloquear
              </label>
              <Input
                id="guardrails-topic-input"
                value={topicDraft}
                placeholder="Ex.: desconto, brinde, segredo"
                onChange={(event) => setTopicDraft(event.target.value)}
                disabled={disabled}
                aria-disabled={disabled || undefined}
              />
              <Button
                type="submit"
                variant="primary"
                disabled={disabled}
                aria-disabled={disabled || undefined}
              >
                Adicionar
              </Button>
            </form>

            {blockTopicTerms.length === 0 ? (
              <p className="text-xs text-slate-500">Nenhum termo configurado.</p>
            ) : (
              <ul className="flex flex-wrap gap-2">
                {blockTopicTerms.map((term) => (
                  <li key={term}>
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs text-slate-700 hover:bg-slate-100"
                      onClick={() => handleRemoveTopic(term)}
                      disabled={disabled}
                      aria-disabled={disabled || undefined}
                    >
                      <span>{term}</span>
                      <span aria-hidden="true">×</span>
                      <span className="sr-only">Remover {term}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between gap-4">
          <div>
            <label htmlFor="guardrails-max-length" className="text-sm font-medium text-slate-800">
              Encurtar respostas longas
            </label>
            <p className="text-xs text-slate-500">
              Se a resposta ultrapassar o limite, a IA corta o texto e registra a violação.
            </p>
          </div>
          <Switch
            id="guardrails-max-length"
            checked={maxLengthEnabled}
            onChange={handleMaxLengthToggle}
            disabled={disabled}
            aria-disabled={disabled || undefined}
          />
        </div>

        {maxLengthEnabled && (
          <div className="space-y-1">
            <label htmlFor="guardrails-max-length-input" className="text-xs font-medium text-slate-600">
              Limite de caracteres pós-resposta
            </label>
            <Input
              id="guardrails-max-length-input"
              type="number"
              min="120"
              step="20"
              value={maxLengthDraft}
              onChange={handleMaxLengthChange}
              disabled={disabled}
              aria-disabled={disabled || undefined}
            />
            <p className="text-xs text-slate-500">Use para canais que exigem mensagens enxutas.</p>
          </div>
        )}
      </div>
    </section>
  );
}

GuardrailsForm.propTypes = {
  value: PropTypes.shape({
    maxReplyChars: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    pre: PropTypes.array,
    post: PropTypes.array,
  }),
  onChange: PropTypes.func,
  disabled: PropTypes.bool,
};

