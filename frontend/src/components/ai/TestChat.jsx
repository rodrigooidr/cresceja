import React, { useMemo, useState } from "react";
import PropTypes from "prop-types";
import inboxApi from "@/api/inboxApi.js";
import { Button, Input, Select } from "@/ui/controls/Input.jsx";
import Switch from "@/ui/controls/Switch.jsx";
import { useToasts } from "@/components/ToastHost.jsx";

const CHANNEL_OPTIONS = [
  { value: "whatsapp", label: "WhatsApp" },
  { value: "instagram", label: "Instagram" },
  { value: "facebook", label: "Facebook Messenger" },
  { value: "web", label: "Widget Web" },
];

export default function TestChat({ orgId = null, draftProfile = null }) {
  const { addToast } = useToasts();
  const [message, setMessage] = useState("");
  const [channel, setChannel] = useState(CHANNEL_OPTIONS[0].value);
  const [useDraft, setUseDraft] = useState(true);
  const [simulateAt, setSimulateAt] = useState("");
  const [loading, setLoading] = useState(false);
  const [reply, setReply] = useState("");
  const [debug, setDebug] = useState(null);
  const [srMessage, setSrMessage] = useState("");

  const canSend = useMemo(
    () => !!orgId && !loading && message.trim().length > 0,
    [orgId, loading, message],
  );

  const resetDebug = () => {
    setReply("");
    setDebug(null);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!canSend) return;

    setLoading(true);
    resetDebug();
    setSrMessage("Enviando mensagem de teste");

    try {
      const payload = {
        message: message.trim(),
        channel,
        useDraft,
      };
      const when = simulateAt.trim();
      if (when) payload.simulateAt = when;
      if (useDraft && draftProfile) {
        payload.profile = draftProfile;
        payload.draftProfile = draftProfile;
      }
      const { data } = await inboxApi.post(`/orgs/${orgId}/ai/test`, payload);
      setReply(data?.reply || "");
      setDebug(data?.debug || null);
      setSrMessage("Resposta de teste recebida");
      addToast("Teste executado com sucesso.");
    } catch (error) {
      addToast("Falha ao testar a IA.");
      setSrMessage("Não foi possível concluir o teste");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="ui-card p-6 space-y-5" data-testid="test-chat">
      <div className="sr-only" aria-live="polite" role="status">
        {srMessage}
      </div>

      <header className="space-y-1">
        <h2 className="text-lg font-semibold text-slate-900">Testar atendimento</h2>
        <p className="text-sm text-slate-500">
          Envie mensagens para validar o comportamento da IA e visualize os detalhes de debug.
        </p>
      </header>

      <form className="space-y-4" onSubmit={handleSubmit}>
        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-1">
            <label htmlFor="test-chat-channel" className="text-sm font-medium text-slate-700">
              Canal
            </label>
            <Select
              id="test-chat-channel"
              value={channel}
              onChange={(event) => setChannel(event.target.value)}
              disabled={loading}
              aria-disabled={loading || undefined}
            >
              {CHANNEL_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </div>

          <div className="space-y-1">
            <label htmlFor="test-chat-simulate" className="text-sm font-medium text-slate-700">
              Simular horário (ISO opcional)
            </label>
            <Input
              id="test-chat-simulate"
              type="datetime-local"
              value={simulateAt}
              onChange={(event) => setSimulateAt(event.target.value)}
              disabled={loading}
              aria-disabled={loading || undefined}
            />
          </div>
        </div>

        <div className="space-y-2">
          <label htmlFor="test-chat-message" className="text-sm font-medium text-slate-700">
            Mensagem
          </label>
          <textarea
            id="test-chat-message"
            className="ui-input min-h-[120px]"
            placeholder="Digite uma mensagem para testar"
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            disabled={loading}
            aria-disabled={loading || undefined}
          />
        </div>

        <div className="flex items-center justify-between gap-3 rounded border border-slate-200 bg-slate-50 px-4 py-3">
          <div>
            <label htmlFor="test-chat-use-draft" className="text-sm font-medium text-slate-800">
              Usar rascunho atual
            </label>
            <p className="text-xs text-slate-500">
              O teste utilizará as configurações do formulário em vez do perfil publicado.
            </p>
          </div>
          <Switch
            id="test-chat-use-draft"
            checked={useDraft}
            onChange={setUseDraft}
            disabled={loading}
            aria-disabled={loading || undefined}
          />
        </div>

        <div className="flex justify-end">
          <Button
            type="submit"
            variant="primary"
            disabled={!canSend}
            aria-disabled={!canSend || undefined}
          >
            {loading ? "Enviando…" : "Enviar mensagem"}
          </Button>
        </div>
      </form>

      {reply && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-slate-800">Resposta</h3>
          <div className="rounded border border-slate-200 bg-white p-3 text-sm text-slate-700">
            {reply}
          </div>
        </div>
      )}

      {debug && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-slate-800">Debug</h3>
          <dl className="grid gap-3 md:grid-cols-2">
            <div className="rounded border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
              <dt className="font-semibold text-slate-700">Tokens</dt>
              <dd>{debug.tokens ?? "—"}</dd>
            </div>
            <div className="rounded border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
              <dt className="font-semibold text-slate-700">Chamadas de ferramenta</dt>
              <dd>
                {Array.isArray(debug.toolCalls) && debug.toolCalls.length > 0 ? (
                  <ul className="list-disc pl-4">
                    {debug.toolCalls.map((call, index) => (
                      <li key={call?.name || index}>{call?.name || call?.type || "Ferramenta"}</li>
                    ))}
                  </ul>
                ) : (
                  <span>—</span>
                )}
              </dd>
            </div>
          </dl>

          <div className="space-y-2">
            <p className="text-xs font-semibold text-slate-700">Documentos do RAG (topK)</p>
            {Array.isArray(debug.contextDocs) && debug.contextDocs.length > 0 ? (
              <ul className="space-y-2 text-xs text-slate-600">
                {debug.contextDocs.map((doc, index) => (
                  <li key={doc?.id || index} className="rounded border border-slate-200 bg-white p-3">
                    <p className="font-medium text-slate-700">Doc {index + 1}</p>
                    <p>{doc?.text || "—"}</p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-slate-500">Nenhum documento retornado.</p>
            )}
          </div>

          <div className="space-y-2">
            <p className="text-xs font-semibold text-slate-700">Violações</p>
            {Array.isArray(debug.violations) && debug.violations.length > 0 ? (
              <ul className="space-y-2 text-xs text-red-600">
                {debug.violations.map((violation, index) => (
                  <li key={violation?.rule || index} className="rounded border border-red-200 bg-red-50 p-3">
                    <p>
                      <span className="font-semibold">Regra:</span> {violation?.rule || "—"}
                    </p>
                    <p>
                      <span className="font-semibold">Estágio:</span> {violation?.stage || "—"}
                    </p>
                    {violation?.details && (
                      <pre className="mt-2 overflow-x-auto rounded bg-white p-2 text-[11px] text-red-700">
                        {JSON.stringify(violation.details, null, 2)}
                      </pre>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-slate-500">Nenhuma violação registrada.</p>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

TestChat.propTypes = {
  orgId: PropTypes.string,
  draftProfile: PropTypes.object,
};

