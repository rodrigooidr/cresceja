import React, { useCallback, useEffect, useMemo, useState } from "react";
import inboxApi, { getPlanSummary } from "../../api/inboxApi";
import { useOrg } from "../../contexts/OrgContext.jsx";
import { useAuth } from "../../contexts/AuthContext";
import { hasGlobalRole, hasOrgRole } from "../../auth/roles";

function formatDate(value) {
  if (!value) return "—";
  try {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return date.toLocaleDateString("pt-BR", { timeZone: "UTC" });
  } catch {
    return String(value ?? "—");
  }
}

export default function OrgPlanPage() {
  const { selected, orgs } = useOrg();
  const { user } = useAuth();
  const canViewPlan = useMemo(
    () => hasOrgRole(["OrgAdmin", "OrgOwner"], user) || hasGlobalRole(["SuperAdmin"], user),
    [user]
  );
  const [state, setState] = useState({
    loading: false,
    error: "",
    summary: null,
    planLabels: {},
  });

  const load = useCallback(async () => {
    if (!selected || !canViewPlan) return;
    setState((s) => ({ ...s, loading: true, error: "" }));
    try {
      const [summaryRes, plansRes] = await Promise.all([
        getPlanSummary(selected),
        inboxApi.get("/public/plans", { meta: { noAuth: true } }),
      ]);

      const planItems = Array.isArray(plansRes?.data?.items) ? plansRes.data.items : [];
      const planLabels = planItems.reduce((acc, plan) => {
        if (plan?.id) acc[plan.id] = plan.name || plan.label || plan.title || plan.id;
        return acc;
      }, {});

      setState({
        loading: false,
        error: "",
        summary: summaryRes?.data ?? null,
        planLabels,
      });
    } catch (e) {
      const message =
        e?.response?.data?.message ||
        e?.response?.data?.error ||
        e?.message ||
        "Não foi possível carregar agora.";
      setState((s) => ({ ...s, loading: false, error: message, summary: null }));
    }
  }, [selected, canViewPlan]);

  useEffect(() => {
    if (!canViewPlan) {
      setState((s) => ({ ...s, summary: null, error: "" }));
      return;
    }
    if (!selected) {
      setState((s) => ({ ...s, summary: null }));
      return;
    }
    load();
  }, [selected, load, canViewPlan]);

  const planLabel = useMemo(() => {
    const org = state.summary?.org;
    if (!org?.plan_id) return "—";
    return state.planLabels[org.plan_id] || org.plan_id;
  }, [state.summary, state.planLabels]);

  const currentOrgName = useMemo(() => {
    const org = orgs?.find((item) => item.id === selected);
    return org?.name || state.summary?.org?.name || "";
  }, [orgs, selected, state.summary]);

  if (!canViewPlan) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-semibold mb-2">Meu Plano</h1>
        <p className="text-sm text-gray-600">Você não tem permissão para visualizar os detalhes do plano.</p>
      </div>
    );
  }

  if (!selected) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-semibold mb-2">Meu Plano</h1>
        <p className="text-sm text-gray-600">Selecione uma organização para ver os detalhes do plano.</p>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Meu Plano</h1>
          {currentOrgName && (
            <p className="text-sm text-gray-500">{currentOrgName}</p>
          )}
        </div>
        <button
          type="button"
          onClick={load}
          className="px-3 py-2 rounded border border-gray-300 text-sm hover:bg-gray-50"
          disabled={state.loading}
        >
          {state.loading ? "Atualizando…" : "Atualizar"}
        </button>
      </div>

      {state.error && (
        <div className="mt-4 rounded border border-amber-300 bg-amber-50 text-amber-900 px-4 py-3 text-sm">
          {state.error}
        </div>
      )}

      <section className="mt-6 rounded-xl border bg-white px-5 py-4 shadow-sm">
        <h2 className="text-lg font-semibold">Plano atual</h2>
        {state.loading && !state.summary ? (
          <div className="mt-4 text-sm text-gray-500">Carregando…</div>
        ) : !state.summary?.org ? (
          <div className="mt-4 text-sm text-gray-500">Nenhuma informação de plano encontrada.</div>
        ) : (
          <div className="mt-4 grid gap-4 md:grid-cols-3 text-sm">
            <div className="rounded border bg-gray-50 p-3">
              <div className="text-xs uppercase text-gray-500">Plano</div>
              <div className="mt-1 text-base font-semibold">{planLabel}</div>
            </div>
            <div className="rounded border bg-gray-50 p-3">
              <div className="text-xs uppercase text-gray-500">Status</div>
              <div className="mt-1 text-base font-semibold">
                {state.summary.org.status || "—"}
              </div>
            </div>
            <div className="rounded border bg-gray-50 p-3">
              <div className="text-xs uppercase text-gray-500">Teste / Trial até</div>
              <div className="mt-1 text-base font-semibold">
                {formatDate(state.summary.org.trial_ends_at)}
              </div>
            </div>
          </div>
        )}
      </section>

      <section className="mt-6 rounded-xl border bg-white px-5 py-4 shadow-sm">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Créditos</h2>
        </div>
        {state.loading && !state.summary ? (
          <div className="mt-4 text-sm text-gray-500">Carregando…</div>
        ) : !state.summary?.credits?.length ? (
          <div className="mt-4 text-sm text-gray-500">Sem créditos.</div>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-3 py-2">Recurso</th>
                  <th className="px-3 py-2">Saldo</th>
                  <th className="px-3 py-2">Expira em</th>
                </tr>
              </thead>
              <tbody>
                {state.summary.credits.map((credit) => (
                  <tr key={`${credit.feature_code}`} className="border-t">
                    <td className="px-3 py-2 font-medium text-gray-700">{credit.feature_code}</td>
                    <td className="px-3 py-2 text-gray-700">{credit.remaining_total ?? 0}</td>
                    <td className="px-3 py-2 text-gray-700">{formatDate(credit.expires_next)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
