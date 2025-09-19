import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import inboxApi from "@/api/inboxApi.js";
import { useOrg } from "@/contexts/OrgContext.jsx";
import PageHeader from "@/ui/PageHeader.jsx";
import { Button, Input, Select } from "@/ui/controls/Input.jsx";
import Switch from "@/ui/controls/Switch.jsx";
import { useToasts } from "@/components/ToastHost.jsx";
import GuardrailsForm from "@/components/ai/GuardrailsForm.jsx";
import RagSourcesCard from "@/components/ai/RagSourcesCard.jsx";
import PromptPreview from "@/components/ai/PromptPreview.jsx";
import TestChat from "@/components/ai/TestChat.jsx";
import ViolationsList from "@/components/ai/ViolationsList.jsx";

const INITIAL_PROFILE = Object.freeze({
  vertical: "",
  brandVoice: "",
  languages: [],
  rag: { enabled: false, topK: "5" },
  guardrails: { maxReplyChars: "", pre: [], post: [] },
  tools: [],
  policies: [],
  fewShot: [],
});

const VERTICAL_CUSTOM = "__custom__";
const VERTICAL_OPTIONS = [
  { value: "", label: "Selecione um segmento" },
  { value: "Saúde", label: "Saúde" },
  { value: "Educação", label: "Educação" },
  { value: "Serviços", label: "Serviços" },
  { value: "Varejo", label: "Varejo" },
  { value: VERTICAL_CUSTOM, label: "Outro (personalizar)" },
];

function normalizeProfile(rawProfile) {
  const profile = rawProfile && typeof rawProfile === "object" ? rawProfile : {};
  const guardrails =
    profile.guardrails && typeof profile.guardrails === "object"
      ? { ...profile.guardrails }
      : {};
  guardrails.pre = Array.isArray(guardrails.pre)
    ? guardrails.pre
        .map((rule) => (rule && typeof rule === "object" ? { ...rule } : null))
        .filter(Boolean)
    : [];
  guardrails.post = Array.isArray(guardrails.post)
    ? guardrails.post
        .map((rule) => (rule && typeof rule === "object" ? { ...rule } : null))
        .filter(Boolean)
    : [];
  const rag = profile.rag && typeof profile.rag === "object" ? { ...profile.rag } : {};
  const languages = Array.isArray(profile.languages) ? profile.languages : [];

  return {
    vertical: typeof profile.vertical === "string" ? profile.vertical : "",
    brandVoice: typeof profile.brandVoice === "string" ? profile.brandVoice : "",
    languages,
    rag: {
      enabled: !!rag.enabled,
      topK:
        rag.topK !== undefined && rag.topK !== null && rag.topK !== ""
          ? String(rag.topK)
          : "5",
    },
    guardrails: {
      ...guardrails,
      maxReplyChars:
        guardrails.maxReplyChars !== undefined && guardrails.maxReplyChars !== null
          ? String(guardrails.maxReplyChars)
          : "",
    },
    tools: Array.isArray(profile.tools) ? profile.tools : [],
    policies: Array.isArray(profile.policies) ? profile.policies : [],
    fewShot: Array.isArray(profile.fewShot) ? profile.fewShot : [],
  };
}

function parseLanguages(text) {
  return (text || "")
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry, index, all) => entry && all.indexOf(entry) === index);
}

function buildPayload(draft, languageDraft) {
  const languages = parseLanguages(languageDraft);
  const guardrails = { ...draft.guardrails };
  if (guardrails.maxReplyChars === "" || guardrails.maxReplyChars === null) {
    delete guardrails.maxReplyChars;
  } else {
    const parsed = Number.parseInt(guardrails.maxReplyChars, 10);
    if (Number.isFinite(parsed) && parsed > 0) {
      guardrails.maxReplyChars = parsed;
    } else {
      delete guardrails.maxReplyChars;
    }
  }

  if (Array.isArray(guardrails.pre)) {
    guardrails.pre = guardrails.pre
      .map((rule) => {
        if (!rule || typeof rule !== "object") return null;
        const base = { type: rule.type };
        if (!base.type) return null;
        if (rule.value !== undefined) base.value = rule.value;
        return base;
      })
      .filter(Boolean);
    if (guardrails.pre.length === 0) delete guardrails.pre;
  }

  if (Array.isArray(guardrails.post)) {
    guardrails.post = guardrails.post
      .map((rule) => {
        if (!rule || typeof rule !== "object") return null;
        const base = { type: rule.type };
        if (!base.type) return null;
        if (rule.limit !== undefined && rule.limit !== "") {
          const parsedLimit = Number.parseInt(rule.limit, 10);
          if (Number.isFinite(parsedLimit) && parsedLimit > 0) {
            base.limit = parsedLimit;
          }
        }
        if (base.type === "maxLength" && base.limit === undefined) {
          return null;
        }
        return base;
      })
      .filter(Boolean);
    if (guardrails.post.length === 0) delete guardrails.post;
  }

  const ragTopK = Number.parseInt(draft.rag?.topK ?? "", 10);
  const rag = {
    enabled: !!draft.rag?.enabled,
    ...(Number.isFinite(ragTopK) && ragTopK > 0 ? { topK: ragTopK } : {}),
  };

  return {
    vertical: draft.vertical?.trim?.() || "",
    brandVoice: draft.brandVoice?.trim?.() || "",
    languages,
    rag,
    guardrails,
    tools: Array.isArray(draft.tools) ? draft.tools : [],
    policies: Array.isArray(draft.policies) ? draft.policies : [],
    fewShot: Array.isArray(draft.fewShot) ? draft.fewShot : [],
  };
}

export default function OrgAIPage() {
  const { selected: orgId } = useOrg();
  const { addToast } = useToasts();
  const [draft, setDraft] = useState(INITIAL_PROFILE);
  const [languageDraft, setLanguageDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [srMessage, setSrMessage] = useState("");
  const mountedRef = useRef(true);

  useEffect(() => () => {
    mountedRef.current = false;
  }, []);

  const announce = useCallback(
    (message) => {
      setSrMessage(message);
      addToast(message);
    },
    [addToast],
  );

  useEffect(() => {
    let active = true;
    if (!orgId) {
      setDraft(INITIAL_PROFILE);
      setLanguageDraft("");
      setLoading(false);
      setSrMessage("Selecione uma organização para configurar a IA");
      return () => {
        active = false;
      };
    }

    setLoading(true);
    setSrMessage("Carregando perfil da IA");

    inboxApi
      .get(`/orgs/${orgId}/ai-profile`)
      .then(({ data }) => {
        if (!active || !mountedRef.current) return;
        const profile = normalizeProfile(data);
        setDraft(profile);
        setLanguageDraft(profile.languages.join(", "));
        setSrMessage("Perfil da IA carregado");
      })
      .catch(() => {
        if (!active || !mountedRef.current) return;
        setDraft(normalizeProfile({}));
        setLanguageDraft("");
        announce("Não foi possível carregar o perfil da IA.");
      })
      .finally(() => {
        if (!active || !mountedRef.current) return;
        setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [orgId, announce]);

  const verticalSelectValue = useMemo(() => {
    const current = draft.vertical || "";
    return VERTICAL_OPTIONS.some((option) => option.value === current)
      ? current
      : VERTICAL_CUSTOM;
  }, [draft.vertical]);

  const promptPreviewProfile = useMemo(
    () => ({
      ...draft,
      languages: parseLanguages(languageDraft),
      guardrails: {
        maxReplyChars: draft.guardrails?.maxReplyChars ?? "",
        pre: Array.isArray(draft.guardrails?.pre) ? draft.guardrails.pre : [],
        post: Array.isArray(draft.guardrails?.post) ? draft.guardrails.post : [],
      },
    }),
    [draft, languageDraft],
  );

  const draftProfilePayload = useMemo(
    () => buildPayload(draft, languageDraft),
    [draft, languageDraft],
  );

  const handleSave = useCallback(
    async (event) => {
      event?.preventDefault?.();
      if (!orgId) return;

      setSaving(true);
      setSrMessage("Salvando perfil da IA");
      try {
        const payload = buildPayload(draft, languageDraft);
        const { data } = await inboxApi.put(`/orgs/${orgId}/ai-profile`, payload);
        if (!mountedRef.current) return;
        const profile = normalizeProfile(data);
        setDraft(profile);
        setLanguageDraft(profile.languages.join(", "));
        announce("Perfil da IA salvo com sucesso.");
      } catch (error) {
        if (!mountedRef.current) return;
        announce("Falha ao salvar o perfil da IA.");
      } finally {
        if (mountedRef.current) {
          setSaving(false);
        }
      }
    },
    [announce, draft, languageDraft, orgId],
  );

  const isSaveDisabled = !orgId || loading || saving;

  return (
    <div className="p-6 space-y-6" data-testid="orgai-page">
      <div aria-live="polite" className="sr-only" role="status">
        {srMessage}
      </div>

      <PageHeader
        title="IA da Organização"
        description="Configure o perfil, guardrails e integrações que direcionam a IA da sua organização."
        breadcrumb={[
          { label: "Configurações", href: "/settings" },
          { label: "IA da Organização" },
        ]}
        actions={
          <Button
            variant="primary"
            type="button"
            onClick={handleSave}
            data-testid="orgai-save"
            disabled={isSaveDisabled}
            aria-disabled={isSaveDisabled}
          >
            {saving ? "Salvando…" : "Salvar"}
          </Button>
        }
      />

      {loading ? (
        <div
          className="ui-card p-6 text-sm text-slate-600"
          data-testid="orgai-loading"
          aria-live="polite"
        >
          Carregando perfil da IA…
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <div className="space-y-6">
            <section className="ui-card p-6 space-y-4">
              <header>
                <h2 className="text-lg font-semibold text-slate-900">Perfil da IA</h2>
                <p className="text-sm text-slate-500">
                  Defina como a IA descreve o negócio e o tom das interações.
                </p>
              </header>

              <div className="space-y-2">
                <label htmlFor="orgai-vertical" className="text-sm font-medium text-slate-700">
                  Segmento principal
                </label>
                <Select
                  id="orgai-vertical"
                  value={verticalSelectValue}
                  onChange={(event) => {
                    const { value } = event.target;
                    setDraft((prev) => ({
                      ...prev,
                      vertical: value === VERTICAL_CUSTOM ? prev.vertical : value,
                    }));
                  }}
                  disabled={!orgId}
                >
                  {VERTICAL_OPTIONS.map((option) => (
                    <option key={option.value || option.label} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                  {verticalSelectValue === VERTICAL_CUSTOM && draft.vertical && (
                    <option value={draft.vertical}>{draft.vertical}</option>
                  )}
                </Select>
                {verticalSelectValue === VERTICAL_CUSTOM && (
                  <Input
                    id="orgai-vertical-custom"
                    name="vertical"
                    value={draft.vertical}
                    placeholder="Digite o segmento do negócio"
                    onChange={(event) => {
                      const { value } = event.target;
                      setDraft((prev) => ({ ...prev, vertical: value }));
                    }}
                  />
                )}
              </div>

              <div className="space-y-2">
                <label htmlFor="orgai-brand-voice" className="text-sm font-medium text-slate-700">
                  Tom da marca
                </label>
                <textarea
                  id="orgai-brand-voice"
                  name="brandVoice"
                  className="ui-input min-h-[120px]"
                  placeholder="Ex.: acolhedor, especialista em saúde preventiva, responde em primeira pessoa"
                  value={draft.brandVoice}
                  onChange={(event) => {
                    const { value } = event.target;
                    setDraft((prev) => ({ ...prev, brandVoice: value }));
                  }}
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="orgai-languages" className="text-sm font-medium text-slate-700">
                  Idiomas aceitos
                </label>
                <Input
                  id="orgai-languages"
                  name="languages"
                  value={languageDraft}
                  placeholder="Ex.: pt-BR, en-US"
                  onChange={(event) => setLanguageDraft(event.target.value)}
                />
                <p className="text-xs text-slate-500">
                  Separe os idiomas com vírgula. O primeiro idioma será priorizado pela IA.
                </p>
              </div>
            </section>

            <GuardrailsForm
              value={draft.guardrails}
              onChange={(next) => {
                setDraft((prev) => ({
                  ...prev,
                  guardrails: { ...prev.guardrails, ...next },
                }));
              }}
              disabled={!orgId || saving}
            />

            <section className="ui-card p-6 space-y-4">
              <header className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">RAG (Base de conhecimento)</h2>
                  <p className="text-sm text-slate-500">
                    Habilite busca em documentos para enriquecer as respostas da IA.
                  </p>
                </div>
                <Switch
                  id="orgai-rag-enabled"
                  aria-label="RAG habilitado"
                  checked={!!draft.rag?.enabled}
                  onChange={(value) => {
                    setDraft((prev) => ({
                      ...prev,
                      rag: { ...prev.rag, enabled: value },
                    }));
                  }}
                />
              </header>

              <div className="space-y-2">
                <label htmlFor="orgai-rag-topk" className="text-sm font-medium text-slate-700">
                  Número de documentos (topK)
                </label>
                <Input
                  id="orgai-rag-topk"
                  name="ragTopK"
                  type="number"
                  min="1"
                  max="20"
                  value={draft.rag?.topK ?? ""}
                  onChange={(event) => {
                    const { value } = event.target;
                    setDraft((prev) => ({
                      ...prev,
                      rag: { ...prev.rag, topK: value },
                    }));
                  }}
                />
                <p className="text-xs text-slate-500">
                  Ajuste quantos trechos relevantes a IA deve considerar ao responder.
                </p>
              </div>

              <RagSourcesCard orgId={orgId} disabled={!orgId || saving} />
            </section>

            <ViolationsList orgId={orgId} />
          </div>

          <div className="space-y-6">
            <section className="ui-card p-6 space-y-4">
              <header>
                <h2 className="text-lg font-semibold text-slate-900">Ferramentas conectadas</h2>
                <p className="text-sm text-slate-500">
                  Visualize integrações disponíveis para automações.
                </p>
              </header>

              {draft.tools.length === 0 ? (
                <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                  Nenhuma ferramenta conectada ainda. Cadastre fluxos ou APIs para habilitar ações.
                </div>
              ) : (
                <ul className="space-y-3">
                  {draft.tools.map((tool, index) => (
                    <li key={tool?.name || index} className="rounded-lg border border-slate-200 p-3">
                      <p className="font-medium text-slate-800">{tool?.name || "Ferramenta"}</p>
                      {tool?.description && (
                        <p className="text-xs text-slate-500 mt-1">{tool.description}</p>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <PromptPreview profile={promptPreviewProfile} />

            <TestChat orgId={orgId} draftProfile={draftProfilePayload} />
          </div>
        </div>
      )}
    </div>
  );
}
