import { useEffect, useMemo, useState } from "react";
import {
  adminGetPlanFeatures,
  adminListPlans,
  adminPutPlanFeatures,
} from "@/api/inboxApi";
import { hasGlobalRole } from "@/auth/roles";
import { useAuth } from "@/contexts/AuthContext";

function formatCurrency(currency, price) {
  if (price === null || price === undefined) return "—";
  try {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: currency || "BRL",
      minimumFractionDigits: 2,
    }).format(Number(price));
  } catch {
    return `${currency || "BRL"} ${price}`;
  }
}

function normalizeFeatures(list = []) {
  return list.map((feature) => {
    const options = Array.isArray(feature.options) ? feature.options : [];
    let value;
    if (feature.type === "boolean") {
      value = Boolean(feature.value);
    } else if (feature.type === "number") {
      value = typeof feature.value === "number" && Number.isFinite(feature.value)
        ? String(feature.value)
        : "";
    } else if (feature.type === "enum") {
      if (typeof feature.value === "string" && options?.includes(feature.value)) {
        value = feature.value;
      } else {
        value = options && options.length ? options[0] : "";
      }
    } else {
      value = typeof feature.value === "string" ? feature.value : "";
    }

    return {
      code: feature.code,
      label: feature.label ?? feature.code,
      type: feature.type,
      value,
      options,
    };
  });
}

export default function PlansPage() {
  const { user } = useAuth();
  const canView = useMemo(
    () => hasGlobalRole(["SuperAdmin", "Support"], user),
    [user]
  );
  const [plans, setPlans] = useState([]);
  const [plansLoading, setPlansLoading] = useState(true);
  const [plansError, setPlansError] = useState("");

  const [selectedPlanId, setSelectedPlanId] = useState(null);
  const selectedPlan = useMemo(
    () => plans.find((plan) => plan.id === selectedPlanId) || null,
    [plans, selectedPlanId]
  );

  const [features, setFeatures] = useState([]);
  const [featuresLoading, setFeaturesLoading] = useState(false);
  const [featuresError, setFeaturesError] = useState("");

  const [saveError, setSaveError] = useState("");
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    if (!canView) {
      setPlans([]);
      setSelectedPlanId(null);
      setPlansError("");
      setPlansLoading(false);
      return;
    }

    let isMounted = true;
    setPlansLoading(true);
    setPlansError("");

    (async () => {
      try {
        const data = await adminListPlans();
        if (!isMounted) return;
        const safeData = Array.isArray(data) ? data : [];
        setPlans(safeData);
        if (safeData.length) {
          setSelectedPlanId((current) => current || safeData[0].id);
        } else {
          setSelectedPlanId(null);
        }
      } catch (err) {
        if (!isMounted) return;
        const message =
          err?.response?.data?.message ||
          err?.response?.data?.error ||
          err?.message ||
          "Não foi possível carregar os planos.";
        setPlansError(message);
        setPlans([]);
        setSelectedPlanId(null);
      } finally {
        if (isMounted) setPlansLoading(false);
      }
    })();
    return () => {
      isMounted = false;
    };
  }, [canView]);

  useEffect(() => {
    if (!selectedPlanId) {
      setFeatures([]);
      setFeaturesError("");
      setHasChanges(false);
      return;
    }

    let isMounted = true;
    setFeaturesLoading(true);
    setFeaturesError("");
    setSaveError("");
    setSaveSuccess(false);

    (async () => {
      try {
        const items = await adminGetPlanFeatures(selectedPlanId);
        if (!isMounted) return;
        setFeatures(normalizeFeatures(items));
        setHasChanges(false);
      } catch (err) {
        if (!isMounted) return;
        const message =
          err?.response?.data?.message ||
          err?.response?.data?.error ||
          err?.message ||
          "Não foi possível carregar as funcionalidades.";
        setFeaturesError(message);
        setFeatures([]);
      } finally {
        if (isMounted) setFeaturesLoading(false);
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [selectedPlanId]);

  const handleSelect = (planId) => {
    if (planId === selectedPlanId) return;
    setSelectedPlanId(planId);
  };

  const handleFeatureChange = (code, updater) => {
    setFeatures((prev) =>
      prev.map((feature) =>
        feature.code === code ? { ...feature, value: updater(feature.value) } : feature
      )
    );
    setHasChanges(true);
    setSaveError("");
    setSaveSuccess(false);
  };

  const handleToggleBoolean = (code) => (event) => {
    const { checked } = event.target;
    handleFeatureChange(code, () => checked);
  };

  const handleChange = (code) => (event) => {
    handleFeatureChange(code, () => event.target.value);
  };

  const handleSave = async () => {
    if (!selectedPlanId || !features.length) return;
    setSaving(true);
    setSaveError("");
    setSaveSuccess(false);

    try {
      const payload = [];
      for (const feature of features) {
        if (!feature?.code) continue;
        if (feature.type === "number") {
          if (feature.value === "") {
            throw new Error("Preencha todos os valores numéricos.");
          }
          const parsed = Number(feature.value);
          if (Number.isNaN(parsed) || !Number.isFinite(parsed)) {
            throw new Error("Valor numérico inválido.");
          }
          payload.push({
            code: feature.code,
            type: "number",
            value: parsed,
          });
        } else if (feature.type === "boolean") {
          payload.push({ code: feature.code, type: "boolean", value: Boolean(feature.value) });
        } else if (feature.type === "enum") {
          if (!feature.value) {
            throw new Error("Selecione uma opção para todos os campos enum.");
          }
          const options = Array.isArray(feature.options) ? feature.options : [];
          payload.push({
            code: feature.code,
            type: "enum",
            value: feature.value,
            options,
          });
        } else {
          payload.push({ code: feature.code, type: "string", value: feature.value ?? "" });
        }
      }

      await adminPutPlanFeatures(selectedPlanId, payload);
      setHasChanges(false);
      setSaveSuccess(true);
    } catch (err) {
      const message =
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        err?.message ||
        "Falha ao salvar as funcionalidades.";
      setSaveError(message);
    } finally {
      setSaving(false);
    }
  };

  if (!canView) {
    return (
      <div className="p-6 text-sm text-gray-600">
        Você não tem permissão para visualizar esta página.
      </div>
    );
  }

  if (plansLoading) {
    return <div className="p-6 text-sm text-gray-600">Carregando planos…</div>;
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Planos</h1>
        {plansError && (
          <p className="mt-2 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {plansError}
          </p>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        <div className="space-y-3">
          <div className="rounded-lg border bg-white shadow-sm">
            <div className="border-b px-4 py-3 text-sm font-medium text-gray-600">Planos</div>
            <ul className="divide-y">
              {plans.map((plan) => (
                <li
                  key={plan.id}
                  data-testid="plan-item"
                  data-plan-id={plan.id}
                  className={`cursor-pointer px-4 py-3 text-sm transition hover:bg-gray-50 ${
                    plan.id === selectedPlanId ? "bg-indigo-50" : ""
                  }`}
                  onClick={() => handleSelect(plan.id)}
                >
                  <div className="font-medium text-gray-800">{plan.name}</div>
                  <div className="text-xs text-gray-500">
                    {formatCurrency(plan.currency, plan.monthly_price)}
                  </div>
                </li>
              ))}
              {!plans.length && !plansError && (
                <li className="px-4 py-3 text-sm text-gray-500">Nenhum plano disponível.</li>
              )}
            </ul>
          </div>
        </div>

        <div className="space-y-4">
          {!selectedPlan && !plansError && (
            <div className="rounded-lg border border-dashed px-4 py-6 text-center text-sm text-gray-500">
              Selecione um plano para visualizar as funcionalidades.
            </div>
          )}

          {selectedPlan && (
            <div className="rounded-lg border bg-white p-6 shadow-sm">
              <header className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">{selectedPlan.name}</h2>
                  <p className="text-sm text-gray-500">
                    Valor mensal: {formatCurrency(selectedPlan.currency, selectedPlan.monthly_price)}
                  </p>
                </div>
                <button
                  type="button"
                  data-testid="btn-save-features"
                  onClick={handleSave}
                  disabled={saving || !hasChanges || featuresLoading || !!featuresError}
                  className={`inline-flex items-center justify-center rounded-md border px-4 py-2 text-sm font-medium transition ${
                    saving || !hasChanges || featuresLoading || !!featuresError
                      ? "cursor-not-allowed border-gray-200 bg-gray-100 text-gray-400"
                      : "border-indigo-500 bg-indigo-500 text-white hover:bg-indigo-600"
                  }`}
                >
                  {saving ? "Salvando…" : "Salvar"}
                </button>
              </header>

              {featuresLoading && (
                <p className="mt-4 text-sm text-gray-500">Carregando funcionalidades…</p>
              )}

              {featuresError && (
                <p className="mt-4 rounded border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
                  {featuresError}
                </p>
              )}

              {!featuresLoading && !featuresError && (
                <div className="mt-4 space-y-4">
                  {features.length === 0 && (
                    <p className="text-sm text-gray-500">Nenhuma funcionalidade configurada.</p>
                  )}

                  {features.map((feature) => (
                    <div
                      key={feature.code}
                      className="rounded border border-gray-200 px-4 py-3"
                    >
                      <div className="text-sm font-medium text-gray-800">
                        {feature.label}
                        <span className="ml-2 text-xs text-gray-400">({feature.code})</span>
                      </div>
                      <div className="mt-2 text-sm text-gray-600">Tipo: {feature.type}</div>

                      <div className="mt-3">
                        {feature.type === "number" && (
                          <input
                            type="number"
                            className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
                            value={feature.value}
                            onChange={handleChange(feature.code)}
                            data-testid={`feature-input-${feature.code}`}
                          />
                        )}

                        {feature.type === "boolean" && (
                          <label className="inline-flex items-center gap-2 text-sm text-gray-700">
                            <input
                              type="checkbox"
                              checked={Boolean(feature.value)}
                              onChange={handleToggleBoolean(feature.code)}
                              className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                              data-testid={`feature-input-${feature.code}`}
                            />
                            <span>Ativo</span>
                          </label>
                        )}

                        {feature.type === "string" && (
                          <input
                            type="text"
                            className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
                            value={feature.value}
                            onChange={handleChange(feature.code)}
                            data-testid={`feature-input-${feature.code}`}
                          />
                        )}

                        {feature.type === "enum" && (
                          <select
                            className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
                            value={feature.value}
                            onChange={handleChange(feature.code)}
                            data-testid={`feature-input-${feature.code}`}
                          >
                            {(feature.options || []).map((option) => (
                              <option key={option} value={option}>
                                {option}
                              </option>
                            ))}
                          </select>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {saveError && (
                <p className="mt-4 rounded border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
                  {saveError}
                </p>
              )}

              {saveSuccess && (
                <p className="mt-4 rounded border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm text-emerald-700">
                  Alterações salvas com sucesso.
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
