import React, { useCallback, useEffect, useMemo, useState } from "react";
import inboxApi, {
  listAdminPlans,
  createPlan,
  updatePlan,
  getPlanFeatures,
  setPlanFeatures,
} from "../../../api/inboxApi";
import { useAuth } from "../../../contexts/AuthContext";
import { hasGlobalRole } from "../../../auth/roles";

function normalizePlans(response) {
  const data = response?.data;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.items)) return data.items;
  if (Array.isArray(data)) return data;
  return [];
}

function hydrateFeatures(items = []) {
  return items.map((feature) => {
    const baseValue = feature?.value;
    const draft = {};
    if (feature.type === "number") {
      const limitValue = typeof baseValue?.limit === "number" ? baseValue.limit : Number(baseValue?.limit ?? 0);
      draft.enabled = !!baseValue?.enabled;
      draft.limit = Number.isFinite(limitValue) ? String(limitValue) : "0";
    } else if (feature.type === "boolean") {
      draft.enabled = !!baseValue?.enabled;
    }
    return {
      ...feature,
      value: baseValue && typeof baseValue === "object" ? { ...baseValue } : baseValue,
      draft,
    };
  });
}

export default function PlansPage() {
  const { user } = useAuth();
  const canManage = hasGlobalRole(["SuperAdmin", "Support"], user);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState("");
  const [plans, setPlans] = useState([]);
  const [selectedId, setSelectedId] = useState(null);

  const [planForm, setPlanForm] = useState({ name: "", period: "monthly", price_cents: 0 });
  const [planSaving, setPlanSaving] = useState(false);
  const [planMessage, setPlanMessage] = useState("");
  const [planError, setPlanError] = useState("");

  const [features, setFeatures] = useState([]);
  const [featuresLoading, setFeaturesLoading] = useState(false);
  const [featuresError, setFeaturesError] = useState("");
  const [featuresMessage, setFeaturesMessage] = useState("");
  const [featureErrors, setFeatureErrors] = useState({});
  const [featuresSaving, setFeaturesSaving] = useState(false);

  useEffect(() => {
    let live = true;
    (async () => {
      if (!canManage) {
        setLoading(false);
        return;
      }
      setLoading(true);
      setListError("");
      try {
        const res = await listAdminPlans();
        const rows = normalizePlans(res);
        if (!live) return;
        setPlans(rows);
      } catch (err) {
        if (!live) return;
        if (err?.response?.status === 404) {
          try {
            const fallback = await inboxApi.get("/public/plans", { meta: { noAuth: true } });
            const rows = normalizePlans(fallback?.data);
            if (!live) return;
            setPlans(rows);
          } catch (fallbackErr) {
            if (!live) return;
            const message =
              fallbackErr?.response?.data?.error ||
              fallbackErr?.message ||
              "Não foi possível carregar os planos.";
            setListError(message);
            setPlans([]);
          }
        } else {
          const message = err?.response?.data?.error || err?.message || "Falha ao carregar planos.";
          setListError(message);
        }
      } finally {
        if (live) setLoading(false);
      }
    })();
    return () => {
      live = false;
    };
  }, [canManage]);

  useEffect(() => {
    if (!selectedId && plans[0]?.id) {
      setSelectedId(plans[0].id);
    }
  }, [plans, selectedId]);

  const selectedPlan = useMemo(() => plans.find((plan) => plan.id === selectedId) || null, [plans, selectedId]);

  useEffect(() => {
    if (!selectedPlan) {
      setPlanForm({ name: "", period: "monthly", price_cents: 0 });
      return;
    }
    setPlanForm({
      name: selectedPlan.name || "",
      period: selectedPlan.period || "monthly",
      price_cents: Number(selectedPlan.price_cents ?? 0),
    });
  }, [selectedPlan]);

  useEffect(() => {
    let live = true;
    if (!selectedId || !canManage) {
      setFeatures([]);
      return () => {
        live = false;
      };
    }
    setFeaturesLoading(true);
    setFeaturesError("");
    setFeaturesMessage("");
    setFeatureErrors({});
    (async () => {
      try {
        const res = await getPlanFeatures(selectedId);
        const data = res?.data?.data ?? res?.data ?? [];
        if (!live) return;
        setFeatures(hydrateFeatures(Array.isArray(data) ? data : []));
      } catch (err) {
        if (!live) return;
        const message = err?.response?.data?.error || err?.message || "Falha ao carregar funcionalidades.";
        setFeaturesError(message);
        setFeatures([]);
      } finally {
        if (live) setFeaturesLoading(false);
      }
    })();
    return () => {
      live = false;
    };
  }, [selectedId, canManage]);

  const handleCreatePlan = useCallback(async () => {
    const name = window.prompt("Nome do plano?");
    if (!name) return;
    const period = window.prompt("Período (ex: monthly)?", "monthly") || "monthly";
    const priceInput = window.prompt("Preço em centavos?", "0");
    const price = Number(priceInput || 0) || 0;
    try {
      const res = await createPlan({ name: name.trim(), period: period.trim() || "monthly", price_cents: price });
      const created = res?.data ?? res;
      setPlans((prev) => {
        const next = [...prev];
        if (created && created.id && !next.find((p) => p.id === created.id)) next.push(created);
        return next;
      });
      if (created?.id) setSelectedId(created.id);
    } catch (err) {
      const message = err?.response?.data?.error || err?.message || "Não foi possível criar o plano.";
      // eslint-disable-next-line no-alert
      window.alert(message);
    }
  }, []);

  const handlePlanField = (field) => (event) => {
    const value = field === "price_cents" ? Number(event.target.value ?? 0) : event.target.value;
    setPlanForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSavePlan = async (event) => {
    event?.preventDefault();
    if (!selectedPlan) return;
    setPlanSaving(true);
    setPlanMessage("");
    setPlanError("");
    try {
      const payload = {
        name: planForm.name?.trim() || selectedPlan.name || "",
        period: planForm.period || "monthly",
        price_cents: Number.isFinite(planForm.price_cents) ? Number(planForm.price_cents) : 0,
      };
      const res = await updatePlan(selectedPlan.id, payload);
      const updated = res?.data ?? res;
      setPlans((prev) =>
        prev.map((plan) => (plan.id === selectedPlan.id ? { ...plan, ...payload, ...updated } : plan))
      );
      setPlanMessage("Plano atualizado.");
    } catch (err) {
      const message = err?.response?.data?.error || err?.message || "Falha ao atualizar o plano.";
      setPlanError(message);
    } finally {
      setPlanSaving(false);
    }
  };

  const handleToggleFeature = (code, enabled) => {
    setFeatures((prev) =>
      prev.map((feature) =>
        feature.code === code
          ? { ...feature, draft: { ...feature.draft, enabled } }
          : feature
      )
    );
  };

  const handleLimitChange = (code, value) => {
    setFeatures((prev) =>
      prev.map((feature) =>
        feature.code === code
          ? { ...feature, draft: { ...feature.draft, limit: value } }
          : feature
      )
    );
    setFeatureErrors((prev) => {
      const next = { ...prev };
      if (value === "" || value === null) {
        delete next[code];
        return next;
      }
      const num = Number(value);
      if (!Number.isInteger(num) || num < 0) next[code] = "Informe um inteiro ≥ 0";
      else delete next[code];
      return next;
    });
  };

  const hasFeatureErrors = useMemo(() => Object.keys(featureErrors).length > 0, [featureErrors]);

  const handleSaveFeatures = async (event) => {
    event?.preventDefault();
    if (!selectedPlan || hasFeatureErrors) return;
    setFeaturesSaving(true);
    setFeaturesError("");
    setFeaturesMessage("");
    try {
      const payload = features.map((feature) => {
        const { draft, ...rest } = feature;
        if (feature.type === "number") {
          const limitValue = draft?.limit === "" ? 0 : Number(draft?.limit ?? 0);
          return {
            ...rest,
            value: { ...(feature.value || {}), enabled: !!draft?.enabled, limit: Number.isFinite(limitValue) ? limitValue : 0 },
          };
        }
        if (feature.type === "boolean") {
          return {
            ...rest,
            value: { ...(feature.value || {}), enabled: !!draft?.enabled },
          };
        }
        return { ...rest, value: feature.value };
      });
      await setPlanFeatures(selectedPlan.id, payload);
      const nextFeatures = payload.map((feature) => {
        const baseDraft = features.find((item) => item.code === feature.code)?.draft ?? {};
        const draft = { ...baseDraft };
        if (feature.type === "number") {
          draft.enabled = !!feature.value?.enabled;
          draft.limit = String(feature.value?.limit ?? 0);
        } else if (feature.type === "boolean") {
          draft.enabled = !!feature.value?.enabled;
        }
        return { ...feature, draft };
      });
      setFeatures(nextFeatures);
      setFeaturesMessage("Funcionalidades salvas.");
    } catch (err) {
      const message = err?.response?.data?.error || err?.message || "Falha ao salvar funcionalidades.";
      setFeaturesError(message);
    } finally {
      setFeaturesSaving(false);
    }
  };

  if (!canManage) return <div>403</div>;
  if (loading) return <div className="p-4">Carregando...</div>;

  return (
    <div className="p-4 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold" data-testid="plans-admin-title">
          Planos
        </h1>
        <button
          type="button"
          onClick={handleCreatePlan}
          className="rounded border px-3 py-2 text-sm text-blue-600 hover:bg-blue-50"
        >
          Novo plano
        </button>
      </div>

      {listError && (
        <div className="rounded border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700">{listError}</div>
      )}

      <div className="flex gap-6">
        <div className="w-1/3 space-y-2">
          <h2 className="text-lg font-semibold">Lista</h2>
          <ul className="space-y-1">
            {plans.map((plan) => (
              <li key={plan.id}>
                <button
                  type="button"
                  onClick={() => setSelectedId(plan.id)}
                  className={`w-full rounded px-3 py-2 text-left text-sm ${
                    plan.id === selectedId ? "bg-blue-100 text-blue-800" : "hover:bg-gray-100"
                  }`}
                >
                  <div className="font-medium">{plan.name || plan.id}</div>
                  <div className="text-xs text-gray-500">{plan.period || "monthly"}</div>
                </button>
              </li>
            ))}
          </ul>
        </div>

        <div className="w-2/3 space-y-6">
          {selectedPlan ? (
            <>
              <form onSubmit={handleSavePlan} className="space-y-3 rounded border bg-white p-4 shadow-sm">
                <h2 className="text-lg font-semibold">Dados do plano</h2>
                {planError && (
                  <div className="rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">{planError}</div>
                )}
                {planMessage && (
                  <div className="rounded border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                    {planMessage}
                  </div>
                )}
                <label className="block text-sm">
                  <span className="text-gray-600">Nome</span>
                  <input
                    type="text"
                    className="mt-1 w-full rounded border px-3 py-2"
                    value={planForm.name}
                    onChange={handlePlanField("name")}
                  />
                </label>
                <label className="block text-sm">
                  <span className="text-gray-600">Período</span>
                  <input
                    type="text"
                    className="mt-1 w-full rounded border px-3 py-2"
                    value={planForm.period}
                    onChange={handlePlanField("period")}
                  />
                </label>
                <label className="block text-sm">
                  <span className="text-gray-600">Preço (centavos)</span>
                  <input
                    type="number"
                    className="mt-1 w-full rounded border px-3 py-2"
                    value={planForm.price_cents}
                    onChange={handlePlanField("price_cents")}
                  />
                </label>
                <div className="flex justify-end">
                  <button
                    type="submit"
                    className="rounded bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
                    disabled={planSaving}
                  >
                    {planSaving ? "Salvando…" : "Salvar plano"}
                  </button>
                </div>
              </form>

              <form
                onSubmit={handleSaveFeatures}
                data-testid="plans-admin-form"
                className="space-y-3 rounded border bg-white p-4 shadow-sm"
              >
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold">Funcionalidades</h2>
                  <button
                    type="submit"
                    data-testid="plans-admin-save"
                    className="rounded bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
                    disabled={featuresSaving || hasFeatureErrors}
                  >
                    {featuresSaving ? "Salvando…" : "Salvar funcionalidades"}
                  </button>
                </div>
                {featuresError && (
                  <div className="rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">{featuresError}</div>
                )}
                {featuresMessage && (
                  <div className="rounded border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                    {featuresMessage}
                  </div>
                )}
                {featuresLoading ? (
                  <div data-testid="plans-admin-skeleton" className="text-sm text-gray-500">
                    Carregando funcionalidades…
                  </div>
                ) : features.length === 0 ? (
                  <div className="text-sm text-gray-500">Nenhuma funcionalidade definida.</div>
                ) : (
                  <div className="space-y-4">
                    {features.map((feature) => (
                      <div key={feature.code} className="rounded border px-3 py-3">
                        <div className="font-medium text-sm text-gray-800">{feature.label || feature.code}</div>
                        <label className="mt-2 flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            data-testid={`feature-toggle-${feature.code}`}
                            checked={!!feature.draft?.enabled}
                            onChange={(event) => handleToggleFeature(feature.code, event.target.checked)}
                          />
                          <span>Habilitado</span>
                        </label>
                        {feature.type === "number" && (
                          <div className="mt-2 text-sm">
                            <label className="block text-xs text-gray-500" htmlFor={`feature-${feature.code}-limit`}>
                              Limite
                            </label>
                            <input
                              id={`feature-${feature.code}-limit`}
                              data-testid={`feature-limit-${feature.code}`}
                              type="number"
                              className="mt-1 w-full rounded border px-3 py-2"
                              value={feature.draft?.limit ?? ""}
                              onChange={(event) => handleLimitChange(feature.code, event.target.value)}
                            />
                            {featureErrors[feature.code] && (
                              <div className="mt-1 text-xs text-red-600">{featureErrors[feature.code]}</div>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </form>
            </>
          ) : (
            <div className="rounded border bg-white p-4 text-sm text-gray-500">Selecione um plano.</div>
          )}
        </div>
      </div>
    </div>
  );
}
