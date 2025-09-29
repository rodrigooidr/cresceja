import { useCallback, useEffect, useMemo, useState } from "react";
import {
  adminCreatePlan,
  adminDeletePlan,
  adminDuplicatePlan,
  adminGetPlanCredits,
  adminListPlans,
  adminUpdatePlan,
  centsToBRL,
  parseBRLToCents,
} from "@/api/inboxApi";
import { hasGlobalRole } from "@/auth/roles";
import { useAuth } from "@/contexts/AuthContext";
import useToastFallback from "@/hooks/useToastFallback";

const AI_METER_OPTIONS = [
  { value: "", label: "Selecione" },
  { value: "content_tokens", label: "Tokens de conteúdo" },
  { value: "assist_tokens", label: "Tokens do assistente" },
  { value: "speech_seconds", label: "Segundos de fala" },
];

const NUMBER_QUOTA_OPTIONS = Array.from({ length: 100 }, (_, index) => index);

function NumberQuotaSelect({ value = 0, onChange, id, label, hint }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-sm font-medium text-slate-600">
        {label}{" "}
        {hint && <em className="text-xs text-slate-400">({hint})</em>}
      </span>
      <select
        id={id}
        className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
        value={String(value ?? 0)}
        onChange={(event) => onChange(Number(event.target.value))}
      >
        {NUMBER_QUOTA_OPTIONS.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}

function PlanCreditsSummary({ planId, refreshKey }) {
  const [state, setState] = useState({ loading: true, credits: [], error: null });

  useEffect(() => {
    if (!planId) return;
    let alive = true;
    setState({ loading: true, credits: [], error: null });
    adminGetPlanCredits(planId)
      .then((res) => {
        if (!alive) return;
        const credits = Array.isArray(res) ? res : [];
        setState({ loading: false, credits, error: null });
      })
      .catch((err) => {
        if (!alive) return;
        setState({ loading: false, credits: [], error: err || new Error('failed') });
      });
    return () => {
      alive = false;
    };
  }, [planId, refreshKey]);

  if (!planId) return null;

  let content;
  if (state.loading) {
    content = (
      <div className="space-y-2">
        <div className="h-4 w-1/3 animate-pulse rounded bg-slate-200" />
        <div className="h-4 w-1/4 animate-pulse rounded bg-slate-200" />
        <div className="h-4 w-1/5 animate-pulse rounded bg-slate-200" />
      </div>
    );
  } else if (state.error) {
    content = <p className="text-sm text-red-600">Erro ao carregar créditos.</p>;
  } else if (!state.credits.length) {
    content = <p className="text-sm text-slate-500">Sem limites configurados</p>;
  } else {
    content = (
      <ul className="mt-2 space-y-1">
        {state.credits.map((credit) => (
          <li key={credit.meter} className="flex items-center justify-between text-sm">
            <span className="font-medium text-slate-700">{credit.meter}</span>
            <span className="text-slate-600">{credit.limit}</span>
          </li>
        ))}
      </ul>
    );
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
            Resumo de créditos
          </h3>
          <p className="text-xs text-slate-500">Limites principais configurados para este plano.</p>
        </div>
      </div>
      <div className="mt-3">{content}</div>
    </div>
  );
}

function mapPlanErrorMessage(message) {
  if (!message) return "Falha ao processar a operação.";
  if (message === "price_out_of_range") {
    return "Preço inválido. Insira um valor entre 0 e 9.999.999,99.";
  }
  if (message === "invalid_price") {
    return "Preço inválido. Insira um número válido.";
  }
  if (message === "name_required") {
    return "Informe o nome do plano.";
  }
  return message;
}

function formatCurrencyDisplay(currency, cents) {
  if (cents === null || cents === undefined) return "";
  const numeric = Number(cents);
  return centsToBRL(Number.isFinite(numeric) ? numeric : 0, currency || "BRL");
}

function normalizeEnumOptions(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  if (typeof raw === "string") {
    const trimmed = raw.trim();
    if (!trimmed) return [];
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) return parsed;
    } catch {
      // ignore JSON parse errors and fallback to comma separated values
    }
    return trimmed
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return [];
}

function extractFeatureValue(raw) {
  if (raw === null || raw === undefined) return null;
  if (typeof raw === "object" && !Array.isArray(raw)) {
    if (Object.prototype.hasOwnProperty.call(raw, "value")) {
      return raw.value;
    }
  }
  return raw;
}

function buildPlanFeaturesMap(planFeatures = []) {
  const map = {};
  for (const entry of Array.isArray(planFeatures) ? planFeatures : []) {
    if (!entry || !entry.plan_id || !entry.feature_code) continue;
    if (!map[entry.plan_id]) map[entry.plan_id] = {};
    map[entry.plan_id][entry.feature_code] = {
      value: extractFeatureValue(entry.value),
      ai_meter_code: entry.ai_meter_code ?? null,
      ai_monthly_quota: entry.ai_monthly_quota ?? null,
      value_type: entry.value_type ?? null,
    };
  }
  return map;
}

function supportsAi(def) {
  if (!def) return false;
  if (def.supports_ai) return true;
  if (def.metadata && typeof def.metadata === "object" && def.metadata.supports_ai) return true;
  if (typeof def.category === "string" && def.category.toLowerCase().includes("ai")) return true;
  return false;
}

function buildFeatureForm(defs = [], planId, featuresByPlan = {}) {
  if (!planId || !Array.isArray(defs)) return [];
  const byPlan = featuresByPlan[planId] || {};
  return defs
    .map((def) => {
      if (!def || !def.code) return null;
      const stored = byPlan[def.code] || {};
      const type = def.type ?? "string";
      const options = normalizeEnumOptions(def.enum_options);
      let value;
      if (type === "boolean") {
        value = stored.value === null || stored.value === undefined ? false : Boolean(stored.value);
      } else if (type === "number") {
        const numeric = Number(stored.value ?? 0);
        value = Number.isFinite(numeric) ? numeric : 0;
      } else if (type === "enum") {
        const defaultValue = options.length ? options[0] : "";
        value = stored.value === null || stored.value === undefined ? defaultValue : String(stored.value);
      } else {
        value = stored.value === null || stored.value === undefined ? "" : String(stored.value);
      }
      return {
        code: def.code,
        label: def.label ?? def.code,
        type,
        category: def.category ?? "geral",
        options,
        unit: def.unit ?? null,
        sort_order: def.sort_order ?? 0,
        value,
        supportsAi: supportsAi(def),
        ai_meter_code: stored.ai_meter_code ?? "",
        ai_monthly_quota:
          stored.ai_monthly_quota === null || stored.ai_monthly_quota === undefined
            ? ""
            : String(stored.ai_monthly_quota),
      };
    })
    .filter(Boolean);
}

function groupFeaturesByCategory(list = []) {
  const map = new Map();
  for (const feature of list) {
    const category = feature.category || "geral";
    if (!map.has(category)) map.set(category, []);
    map.get(category).push(feature);
  }
  return Array.from(map.entries())
    .map(([category, items]) => ({
      category,
      items: items.sort((a, b) => {
        const order = (a.sort_order ?? 0) - (b.sort_order ?? 0);
        if (order !== 0) return order;
        return a.label.localeCompare(b.label);
      }),
    }))
    .sort((a, b) => a.category.localeCompare(b.category));
}

function featureToPayload(feature) {
  const payload = { feature_code: feature.code };
  if (feature.type === "boolean") {
    payload.value_bool = Boolean(feature.value);
  } else if (feature.type === "number") {
    if (feature.value === null || feature.value === undefined) {
      payload.value_number = null;
    } else {
      const normalized = Number(feature.value);
      payload.value_number = Number.isFinite(normalized) ? normalized : null;
    }
  } else if (feature.type === "enum" || feature.type === "string") {
    payload.value = feature.value ?? "";
  } else {
    payload.value = feature.value;
  }

  if (feature.supportsAi || feature.ai_meter_code || feature.ai_monthly_quota) {
    payload.ai_meter_code = feature.ai_meter_code ? feature.ai_meter_code : null;
    if (feature.ai_monthly_quota === null || feature.ai_monthly_quota === undefined || feature.ai_monthly_quota === "") {
      payload.ai_monthly_quota = null;
    } else {
      const quota = Number(String(feature.ai_monthly_quota).replace(/,/g, "."));
      payload.ai_monthly_quota = Number.isFinite(quota) ? quota : null;
    }
  }

  return payload;
}

function createModalState() {
  return {
    name: "",
    currency: "BRL",
    is_active: true,
  };
}

function formatCategoryLabel(category) {
  const text = category || "geral";
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export default function PlansPage() {
  const { user } = useAuth();
  const toast = useToastFallback();
  const canView = useMemo(() => hasGlobalRole(["SuperAdmin", "Support"], user), [user]);

  const [plans, setPlans] = useState([]);
  const [featureDefs, setFeatureDefs] = useState([]);
  const [featuresByPlan, setFeaturesByPlan] = useState({});
  const [plansLoading, setPlansLoading] = useState(true);
  const [plansError, setPlansError] = useState("");

  const [selectedPlanId, setSelectedPlanId] = useState(null);
  const selectedPlan = useMemo(
    () => plans.find((plan) => plan.id === selectedPlanId) || null,
    [plans, selectedPlanId]
  );

  const [form, setForm] = useState({
    name: "",
    currency: "BRL",
    is_active: true,
  });
  const [priceStr, setPriceStr] = useState(centsToBRL(0, "BRL"));
  const [featureForm, setFeatureForm] = useState([]);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const [actionLoading, setActionLoading] = useState(false);

  const [modalOpen, setModalOpen] = useState(false);
  const [modalForm, setModalForm] = useState(createModalState);
  const [modalPriceStr, setModalPriceStr] = useState(centsToBRL(0, "BRL"));
  const [modalError, setModalError] = useState("");
  const [modalSaving, setModalSaving] = useState(false);
  const [pageError, setPageError] = useState("");

  const groupedFeatures = useMemo(() => groupFeaturesByCategory(featureForm), [featureForm]);

  const markDirty = useCallback(() => {
    setDirty(true);
    setSaveSuccess(false);
    setPageError("");
  }, []);

  const applyFeatureUpdate = useCallback(
    (code, updater) => {
      setFeatureForm((prev) =>
        prev.map((item) => (item.code === code ? { ...item, ...updater(item) } : item))
      );
      markDirty();
    },
    [markDirty]
  );

  const handleNameChange = (event) => {
    const value = event.target.value;
    setForm((prev) => ({ ...prev, name: value }));
    markDirty();
  };

  const handleCurrencyChange = (event) => {
    const currency = event.target.value;
    setForm((prev) => ({
      ...prev,
      currency,
    }));
    setPriceStr((prevValue) => {
      const cents = parseBRLToCents(prevValue);
      const safeCents = Number.isFinite(cents) && cents >= 0 ? cents : 0;
      return centsToBRL(safeCents, currency);
    });
    markDirty();
  };

  const handlePriceChange = (event) => {
    const raw = event.target.value;
    if (/^[\d.,\sR$]*$/.test(raw) || raw === "") {
      setPriceStr(raw);
      markDirty();
    }
  };

  const handlePriceBlur = () => {
    const cents = parseBRLToCents(priceStr);
    const safeCents = Number.isFinite(cents) && cents >= 0 ? cents : 0;
    setPriceStr(centsToBRL(safeCents, form.currency));
  };

  const handleActiveToggle = (event) => {
    setForm((prev) => ({ ...prev, is_active: event.target.checked }));
    markDirty();
  };

  const handleFeatureBooleanChange = useCallback(
    (code, checked) => {
      applyFeatureUpdate(code, () => ({ value: checked }));
    },
    [applyFeatureUpdate]
  );

  const handleFeatureNumberChange = useCallback(
    (code, value) => {
      applyFeatureUpdate(code, () => ({ value }));
    },
    [applyFeatureUpdate]
  );

  const handleFeatureTextChange = useCallback(
    (code, value) => {
      applyFeatureUpdate(code, () => ({ value }));
    },
    [applyFeatureUpdate]
  );

  const handleFeatureAiMeterChange = useCallback(
    (code, meter) => {
      applyFeatureUpdate(code, () => ({ ai_meter_code: meter }));
    },
    [applyFeatureUpdate]
  );

  const handleFeatureAiQuotaChange = useCallback(
    (code, raw) => {
      const sanitized = raw.replace(/[^0-9.,]/g, "");
      applyFeatureUpdate(code, () => ({ ai_monthly_quota: sanitized }));
    },
    [applyFeatureUpdate]
  );

  const loadPlans = useCallback(async () => {
    setPlansLoading(true);
    try {
      const { plans: planList, feature_defs, plan_features } = await adminListPlans();
      const safePlans = Array.isArray(planList) ? planList : [];
      setPlans(safePlans);
      setFeatureDefs(Array.isArray(feature_defs) ? feature_defs : []);
      setFeaturesByPlan(buildPlanFeaturesMap(plan_features));
      setPlansError("");
      setPageError("");
      if (safePlans.length) {
        setSelectedPlanId((current) => {
          if (current && safePlans.some((plan) => plan.id === current)) return current;
          return safePlans[0].id;
        });
      } else {
        setSelectedPlanId(null);
      }
    } catch (error) {
      const message =
        error?.response?.data?.message ||
        error?.response?.data?.error ||
        error?.message ||
        "Não foi possível carregar os planos.";
      setPlansError(message);
      setPlans([]);
      setFeatureDefs([]);
      setFeaturesByPlan({});
      setSelectedPlanId(null);
      setPageError(message);
    } finally {
      setPlansLoading(false);
    }
  }, []);

  const handleSave = async () => {
    if (!selectedPlanId) return;
    setSaving(true);
    setPageError("");
    setSaveSuccess(false);
    try {
      const priceCents = parseBRLToCents(priceStr);
      if (!Number.isFinite(priceCents) || priceCents < 0) {
        const message = mapPlanErrorMessage("invalid_price");
        setPageError(message);
        toast({ title: message, status: "error" });
        setSaving(false);
        return;
      }
      const payload = {
        name: form.name?.trim(),
        price_cents: priceCents,
        currency: form.currency,
        is_active: !!form.is_active,
        features: featureForm.map(featureToPayload),
      };
      await adminUpdatePlan(selectedPlanId, payload);
      await loadPlans();
      setSaveSuccess(true);
      setDirty(false);
      toast({ title: "Plano salvo" });
    } catch (error) {
      const code = error?.response?.data?.error;
      const detail = error?.response?.data?.message;
      const message =
        code === "invalid_ai_meter_code"
          ? "Medidor de IA inválido."
          : code === "invalid_ai_quota"
          ? "Cota de IA inválida."
          : mapPlanErrorMessage(detail || error?.message || "Falha ao salvar plano.");
      setPageError(message);
      toast({ title: message, status: "error" });
    } finally {
      setSaving(false);
    }
  };

  const handleDuplicate = async () => {
    if (!selectedPlanId) return;
    setActionLoading(true);
    setPageError("");
    try {
      const response = await adminDuplicatePlan(selectedPlanId);
      const duplicated = response?.data?.data;
      await loadPlans();
      if (duplicated?.id) {
        setSelectedPlanId(duplicated.id);
      }
      toast({ title: "Plano duplicado" });
    } catch (error) {
      const message = mapPlanErrorMessage(
        error?.response?.data?.message ||
          error?.response?.data?.error ||
          error?.message ||
          "Falha ao duplicar plano."
      );
      setPageError(message);
      toast({ title: message, status: "error" });
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedPlanId) return;
    if (!window.confirm("Deseja realmente excluir este plano?")) return;
    setActionLoading(true);
    setPageError("");
    try {
      await adminDeletePlan(selectedPlanId);
      await loadPlans();
      toast({ title: "Plano excluído" });
    } catch (error) {
      const message =
        error?.response?.status === 409
          ? "Plano em uso por organizações"
          : mapPlanErrorMessage(
              error?.response?.data?.message ||
                error?.response?.data?.error ||
                error?.message ||
                "Falha ao excluir plano."
            );
      setPageError(message);
      toast({ title: message, status: "error" });
    } finally {
      setActionLoading(false);
    }
  };

  const openModal = () => {
    setModalForm(createModalState());
    setModalPriceStr(centsToBRL(0, "BRL"));
    setModalError("");
    setModalOpen(true);
  };

  const closeModal = () => {
    if (modalSaving) return;
    setModalOpen(false);
    setModalError("");
  };

  const handleModalNameChange = (event) => {
    setModalForm((prev) => ({ ...prev, name: event.target.value }));
  };

  const handleModalCurrencyChange = (event) => {
    const currency = event.target.value;
    setModalForm((prev) => ({
      ...prev,
      currency,
    }));
    setModalPriceStr((prevValue) => {
      const cents = parseBRLToCents(prevValue);
      const safeCents = Number.isFinite(cents) && cents >= 0 ? cents : 0;
      return centsToBRL(safeCents, currency);
    });
  };

  const handleModalPriceChange = (event) => {
    const raw = event.target.value;
    if (/^[\d.,\sR$]*$/.test(raw) || raw === "") {
      setModalPriceStr(raw);
    }
  };

  const handleModalPriceBlur = () => {
    const cents = parseBRLToCents(modalPriceStr);
    const safeCents = Number.isFinite(cents) && cents >= 0 ? cents : 0;
    setModalPriceStr(centsToBRL(safeCents, modalForm.currency));
  };

  const handleModalActiveToggle = (event) => {
    setModalForm((prev) => ({ ...prev, is_active: event.target.checked }));
  };

  const handleCreatePlanAction = async () => {
    setModalError("");
    const name = modalForm.name.trim();
    if (!name) {
      setModalError("Informe o nome do plano.");
      return;
    }
    const priceCents = parseBRLToCents(modalPriceStr);
    if (!Number.isFinite(priceCents) || priceCents < 0) {
      setModalError(mapPlanErrorMessage("invalid_price"));
      return;
    }
    setModalSaving(true);
    try {
      const response = await adminCreatePlan({
        name,
        currency: modalForm.currency,
        price_cents: priceCents,
        is_active: !!modalForm.is_active,
      });
      const created = response?.data?.data;
      setModalOpen(false);
      setModalForm(createModalState());
      setModalPriceStr(centsToBRL(0, "BRL"));
      await loadPlans();
      if (created?.id) setSelectedPlanId(created.id);
      toast({ title: "Plano criado" });
    } catch (error) {
      const message = mapPlanErrorMessage(
        error?.response?.data?.message ||
          error?.response?.data?.error ||
          error?.message ||
          "Falha ao criar plano."
      );
      setModalError(message);
      toast({ title: message, status: "error" });
    } finally {
      setModalSaving(false);
    }
  };

  useEffect(() => {
    if (!canView) {
      setPlans([]);
      setFeatureDefs([]);
      setFeaturesByPlan({});
      setPlansLoading(false);
      setPlansError("");
      setSelectedPlanId(null);
      return;
    }
    loadPlans();
  }, [canView, loadPlans]);

  useEffect(() => {
    if (!selectedPlan) {
      setForm({
        name: "",
        currency: "BRL",
        is_active: true,
      });
      setPriceStr(centsToBRL(0, "BRL"));
      setFeatureForm([]);
      setDirty(false);
      setSaveSuccess(false);
      setPageError("");
      return;
    }
    const currency = selectedPlan.currency || "BRL";
    const priceCents = Number(selectedPlan.price_cents ?? 0);
    setForm({
      name: selectedPlan.name || "",
      currency,
      is_active: Boolean(selectedPlan.is_active),
    });
    setPriceStr(centsToBRL(priceCents, currency));
    setFeatureForm(buildFeatureForm(featureDefs, selectedPlan.id, featuresByPlan));
    setDirty(false);
    setSaveSuccess(false);
    setPageError("");
  }, [selectedPlan, featureDefs, featuresByPlan]);

  if (!canView) {
    return (
      <div className="p-6">
        <div className="mx-auto max-w-4xl space-y-2">
          <h1 className="text-2xl font-semibold text-slate-900">Planos</h1>
          <p className="text-sm text-slate-500">
            Você não possui permissão para visualizar os planos.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mx-auto flex max-w-6xl flex-col gap-6">
        <header className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold text-slate-900">Planos</h1>
            <p className="text-sm text-slate-500">
              Gerencie preços, recursos e disponibilidade de cada plano.
            </p>
          </div>
          <div className="sticky top-2 z-10 flex flex-wrap justify-end gap-2">
            <button
              type="button"
              className="btn btn-primary"
              onClick={openModal}
              disabled={plansLoading || actionLoading}
            >
              Novo
            </button>
            <button
              type="button"
              className="btn"
              onClick={handleDuplicate}
              disabled={!selectedPlanId || actionLoading || plansLoading}
            >
              Duplicar
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleSave}
              disabled={!dirty || saving || plansLoading}
            >
              {saving ? "Salvando..." : "Salvar"}
            </button>
            <button
              type="button"
              className="btn btn-danger"
              onClick={handleDelete}
              disabled={!selectedPlanId || actionLoading || plansLoading}
            >
              Excluir
            </button>
          </div>
        </header>

        {plansError && (
          <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {plansError}
          </div>
        )}

        {pageError && selectedPlanId && (
          <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {pageError}
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-[320px,1fr]">
          <aside className="rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 px-5 py-4">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Planos</h2>
            </div>
            <div className="max-h-[70vh] overflow-y-auto px-5 py-4">
              {plansLoading ? (
                <p className="text-sm text-slate-500">Carregando...</p>
              ) : plans.length === 0 ? (
                <p className="text-sm text-slate-500">Nenhum plano cadastrado.</p>
              ) : (
                <ul className="space-y-2">
                  {plans.map((plan) => {
                    const priceLabel = formatCurrencyDisplay(
                      plan.currency || "BRL",
                      Number(plan.price_cents ?? 0)
                    );
                    const isSelected = plan.id === selectedPlanId;
                    return (
                      <li key={plan.id}>
                        <button
                          type="button"
                          onClick={() => setSelectedPlanId(plan.id)}
                          className={`flex w-full flex-col gap-2 rounded-lg border px-4 py-3 text-left transition ${
                            isSelected
                              ? "border-blue-500 bg-blue-50 text-blue-900 shadow-sm"
                              : "border-slate-200 bg-white hover:border-blue-300"
                          }`}
                          disabled={plansLoading}
                        >
                          <span className="text-sm font-semibold text-slate-800">{plan.name}</span>
                          <div className="flex items-center gap-2 text-xs text-slate-500">
                            <span>{priceLabel}</span>
                            <span
                              className={`rounded-full px-2 py-0.5 ${
                                plan.is_active
                                  ? "bg-emerald-100 text-emerald-700"
                                  : "bg-slate-200 text-slate-600"
                              }`}
                            >
                              {plan.is_active ? "Ativo" : "Inativo"}
                            </span>
                          </div>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </aside>

          <section className="space-y-6">
            {plansLoading ? (
              <p className="text-sm text-slate-500">Carregando dados do plano...</p>
            ) : !selectedPlan ? (
              <p className="text-sm text-slate-500">Selecione um plano para editar.</p>
            ) : (
              <div className="space-y-6">
                {selectedPlan?.id && (
                  <PlanCreditsSummary
                    planId={selectedPlan.id}
                    refreshKey={selectedPlan.updated_at}
                  />
                )}
                <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                  <div className="grid gap-4 md:grid-cols-2">
                    <label className="flex flex-col gap-1 text-sm">
                      <span className="font-medium text-slate-700">Nome do plano</span>
                      <input
                        type="text"
                        value={form.name}
                        onChange={handleNameChange}
                        className="rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                        placeholder="Ex.: Plano Premium"
                      />
                    </label>
                    <label className="flex flex-col gap-1 text-sm">
                      <span className="font-medium text-slate-700">Preço</span>
                      <input
                        type="text"
                        inputMode="decimal"
                        pattern="[0-9.,]*"
                        value={priceStr}
                        onChange={handlePriceChange}
                        onBlur={handlePriceBlur}
                        className="rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                        placeholder="R$ 0,00"
                      />
                    </label>
                    <label className="flex flex-col gap-1 text-sm">
                      <span className="font-medium text-slate-700">Moeda</span>
                      <select
                        value={form.currency}
                        onChange={handleCurrencyChange}
                        className="rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                      >
                        <option value="BRL">BRL</option>
                        <option value="USD">USD</option>
                      </select>
                    </label>
                    <div className="flex flex-col gap-1 text-sm">
                      <span className="font-medium text-slate-700">Status</span>
                      <label className="inline-flex items-center gap-2 text-sm text-slate-600">
                        <input
                          type="checkbox"
                          className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                          checked={form.is_active}
                          onChange={handleActiveToggle}
                        />
                        <span>{form.is_active ? "Plano ativo" : "Plano inativo"}</span>
                      </label>
                    </div>
                  </div>
                  {saveSuccess && (
                    <div className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                      Alterações salvas com sucesso.
                    </div>
                  )}
                </div>

                {groupedFeatures.length > 0 && (
                  <div className="space-y-6">
                    {groupedFeatures.map(({ category, items }) => (
                      <div
                        key={category}
                        className="space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
                      >
                        <div className="flex items-center justify-between">
                          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                            {formatCategoryLabel(category)}
                          </h3>
                          <span className="text-xs text-slate-400">{items.length} itens</span>
                        </div>
                        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                          {items.map((feature) => {
                            const showAi = feature.supportsAi;
                            const fieldId = `feature-${feature.code}`;
                            const aiControls = showAi ? (
                              <div className="grid grid-cols-1 gap-3 text-xs text-slate-600 md:grid-cols-2">
                                <label className="flex flex-col gap-1">
                                  <span className="font-medium text-slate-600">Medidor de IA</span>
                                  <select
                                    value={feature.ai_meter_code}
                                    onChange={(event) =>
                                      handleFeatureAiMeterChange(feature.code, event.target.value)
                                    }
                                    className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                                  >
                                    {AI_METER_OPTIONS.map((option) => (
                                      <option key={option.value} value={option.value}>
                                        {option.label}
                                      </option>
                                    ))}
                                  </select>
                                </label>
                                <label className="flex flex-col gap-1">
                                  <span className="font-medium text-slate-600">Cota mensal</span>
                                  <input
                                    type="text"
                                    value={feature.ai_monthly_quota ?? ""}
                                    onChange={(event) =>
                                      handleFeatureAiQuotaChange(feature.code, event.target.value)
                                    }
                                    className="rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                                    placeholder="Ex.: 50000"
                                  />
                                </label>
                              </div>
                            ) : null;

                            if (feature.type === "boolean") {
                              return (
                                <div
                                  key={feature.code}
                                  className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4"
                                >
                                  <div className="flex items-center justify-between">
                                    <span className="text-sm font-medium text-slate-700">{feature.label}</span>
                                    <label className="inline-flex items-center gap-2 text-sm text-slate-600">
                                      <input
                                        type="checkbox"
                                        className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                                        checked={!!feature.value}
                                        onChange={(event) =>
                                          handleFeatureBooleanChange(feature.code, event.target.checked)
                                        }
                                      />
                                      <span>{feature.value ? "Sim" : "Não"}</span>
                                    </label>
                                  </div>
                                  {aiControls}
                                </div>
                              );
                            }

                            if (feature.type === "number") {
                              return (
                                <div
                                  key={feature.code}
                                  className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4"
                                >
                                  <NumberQuotaSelect
                                    id={fieldId}
                                    label={feature.label}
                                    hint={feature.unit || undefined}
                                    value={Number(feature.value ?? 0)}
                                    onChange={(value) => handleFeatureNumberChange(feature.code, value)}
                                  />
                                  {aiControls}
                                </div>
                              );
                            }

                            if (feature.type === "enum") {
                              return (
                                <div
                                  key={feature.code}
                                  className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4"
                                >
                                  <label
                                    htmlFor={fieldId}
                                    className="flex flex-col gap-1 text-sm text-slate-600"
                                  >
                                    <span className="font-medium text-slate-700">{feature.label}</span>
                                    <select
                                      id={fieldId}
                                      value={feature.value}
                                      onChange={(event) =>
                                        handleFeatureTextChange(feature.code, event.target.value)
                                      }
                                      className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                                    >
                                      {feature.options.map((option) => (
                                        <option key={option} value={option}>
                                          {option}
                                        </option>
                                      ))}
                                    </select>
                                  </label>
                                  {aiControls}
                                </div>
                              );
                            }

                            return (
                              <div
                                key={feature.code}
                                className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4"
                              >
                                <label
                                  htmlFor={fieldId}
                                  className="flex flex-col gap-1 text-sm text-slate-600"
                                >
                                  <span className="font-medium text-slate-700">{feature.label}</span>
                                  <input
                                    id={fieldId}
                                    type="text"
                                    value={feature.value ?? ""}
                                    onChange={(event) =>
                                      handleFeatureTextChange(feature.code, event.target.value)
                                    }
                                    className="rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                                  />
                                </label>
                                {aiControls}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </section>
        </div>
      </div>

      {modalOpen && (
        <div
          role="presentation"
          onClick={closeModal}
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 px-4 py-10"
        >
          <div
            role="dialog"
            onClick={(event) => event.stopPropagation()}
            className="w-full max-w-md space-y-4 rounded-xl bg-white p-6 shadow-xl"
          >
            <h2 className="text-lg font-semibold text-slate-900">Novo plano</h2>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-slate-700">Nome</span>
              <input
                type="text"
                value={modalForm.name}
                onChange={handleModalNameChange}
                className="rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                placeholder="Ex.: Plano Corporativo"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-slate-700">Preço</span>
              <input
                type="text"
                inputMode="decimal"
                pattern="[0-9.,]*"
                value={modalPriceStr}
                onChange={handleModalPriceChange}
                onBlur={handleModalPriceBlur}
                className="rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                placeholder="R$ 0,00"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-slate-700">Moeda</span>
              <select
                value={modalForm.currency}
                onChange={handleModalCurrencyChange}
                className="rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
              >
                <option value="BRL">BRL</option>
                <option value="USD">USD</option>
              </select>
            </label>
            <label className="inline-flex items-center gap-2 text-sm text-slate-600">
              <input
                type="checkbox"
                checked={modalForm.is_active}
                onChange={handleModalActiveToggle}
                className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              <span>Plano ativo</span>
            </label>
            {modalError && (
              <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {modalError}
              </div>
            )}
            <div className="flex justify-end gap-2">
              <button type="button" className="btn" onClick={closeModal} disabled={modalSaving}>
                Cancelar
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleCreatePlanAction}
                disabled={modalSaving}
              >
                {modalSaving ? "Criando..." : "Criar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
