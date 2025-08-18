// src/pages/Admin/AdminClients.jsx
import React, { useEffect, useMemo, useState } from "react";
import api from "../../api/api";

// helpers de data
const ymd = (d) => (d ? new Date(d).toISOString().slice(0, 10) : "");
const addMonths = (date, n = 1) => {
  const d = new Date(date);
  d.setMonth(d.getMonth() + Number(n || 0));
  return d;
};
const addDays = (date, n = 0) => new Date(new Date(date).getTime() + Number(n || 0) * 86400 * 1000);
const todayISO = () => ymd(new Date());
const daysLeft = (end) => {
  if (!end) return null;
  const diff = Math.ceil((new Date(end) - new Date()) / (1000 * 60 * 60 * 24));
  return diff;
};

// compat snake_case/camelCase vindos do backend
const getPlanField = (p, snake, camel, defVal) => (p?.[snake] ?? p?.[camel] ?? defVal);

export default function AdminClients() {
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState(null);
  const [items, setItems] = useState([]);
  const [plans, setPlans] = useState([]);
  const [q, setQ] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [verifyingId, setVerifyingId] = useState(null);

  // Carrega clientes + planos
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        setErrorMsg("");
        const [clientsRes, plansRes] = await Promise.all([
          api.get(`/api/admin/clients`, { params: { query: q } }),
          api.get(`/api/public/plans`), // usa público como fonte de verdade para opções
        ]);
        if (!mounted) return;

        const rawClients = clientsRes?.data?.clients || clientsRes?.data || [];
        const rawPlans = Array.isArray(plansRes?.data?.plans)
          ? plansRes.data.plans
          : Array.isArray(plansRes?.data)
          ? plansRes.data
          : [];

        // adiciona campos efêmeros para inputs de pagamento
        const clients = (rawClients || []).map((c) => ({
          ...c,
          _session_id: "",
          _payment_id: "",
        }));

        setItems(clients);
        setPlans(rawPlans);
      } catch (e) {
        console.error("AdminClients load error", e);
        const status = e?.response?.status;
        if (status === 401) setErrorMsg("Faça login para acessar esta área.");
        else if (status === 403) setErrorMsg("Você precisa ser administrador.");
        else setErrorMsg("Não foi possível carregar os dados.");
        setItems([]);
        setPlans([]);
      } finally {
        setLoading(false);
      }
    })();

    return () => (mounted = false);
  }, [q]);

  const planById = useMemo(() => {
    const m = {};
    for (const p of plans) m[p.id] = p;
    return m;
  }, [plans]);

  const handleChange = (id, field, value) => {
    setItems((prev) => prev.map((c) => (c.id === id ? { ...c, [field]: value } : c)));
  };

  const saveClient = async (c) => {
    try {
      setSavingId(c.id);
      const body = {
        active: !!c.active,
        start_date: c.start_date ? ymd(c.start_date) : null,
        end_date: c.end_date ? ymd(c.end_date) : null,
        plan_id: c.plan_id || null,
      };
      await api.patch(`/api/admin/clients/${c.id}`, body);
    } catch (e) {
      console.error("saveClient", e);
      alert("Falha ao salvar cliente.");
    } finally {
      setSavingId(null);
    }
  };

  // aplica período a partir das regras do plano (free = trial_days; pago = billing_months)
  const applyPeriodFromPlan = async (c) => {
    try {
      const plan = planById[c.plan_id];
      if (!plan) {
        alert("Selecione um plano primeiro.");
        return;
      }
      const isFree = !!getPlanField(plan, "is_free", "isFree", false);
      const start = todayISO();
      let end;

      if (isFree) {
        const trialDays = Number(getPlanField(plan, "trial_days", "trialDays", 14));
        end = ymd(addDays(new Date(), trialDays));
      } else {
        const months = Number(getPlanField(plan, "billing_period_months", "billingPeriodMonths", 1));
        end = ymd(addMonths(new Date(), months));
      }

      const body = { active: true, start_date: start, end_date: end, plan_id: c.plan_id || null };
      await api.patch(`/api/admin/clients/${c.id}`, body);

      setItems((prev) =>
        prev.map((x) => (x.id === c.id ? { ...x, ...body, _session_id: "", _payment_id: "" } : x))
      );
      alert(isFree ? "Período FREE aplicado." : "Período do plano aplicado.");
    } catch (e) {
      console.error("applyPeriodFromPlan", e);
      alert("Erro ao aplicar período do plano.");
    }
  };

  // Verifica pagamento (Stripe session_id OU MP payment_id) e aplica período (não exige pagamento se plano for FREE)
  const verifyAndApply = async (c) => {
    try {
      setVerifyingId(c.id);
      const plan = planById[c.plan_id];
      if (!plan) {
        alert("Selecione um plano primeiro.");
        return;
      }
      const isFree = !!getPlanField(plan, "is_free", "isFree", false);

      // Se FREE, não precisa verificar pagamento: aplica direto
      if (isFree) {
        await applyPeriodFromPlan(c);
        return;
      }

      if (!c._session_id && !c._payment_id) {
        alert("Informe o Stripe session_id ou o Mercado Pago payment_id");
        return;
      }

      const params = {};
      if (c._session_id) params.session_id = c._session_id;
      if (c._payment_id) params.payment_id = c._payment_id;
      if (c.plan_id) params.plan = c.plan_id;

      const { data } = await api.get(`/api/billing/verify`, { params });
      if (data?.status === "paid" || data?.dev) {
        await applyPeriodFromPlan(c);
      } else {
        alert(`Status do pagamento: ${data?.status || "desconhecido"}`);
      }
    } catch (e) {
      console.error("verifyAndApply", e);
      alert("Erro ao verificar pagamento.");
    } finally {
      setVerifyingId(null);
    }
  };

  const filtered = useMemo(() => {
    if (!q) return items;
    const s = q.toLowerCase();
    return items.filter(
      (c) =>
        String(c.name || "").toLowerCase().includes(s) ||
        String(c.email || "").toLowerCase().includes(s) ||
        String(c.company_name || "").toLowerCase().includes(s)
    );
  }, [items, q]);

  return (
    <div className="p-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Admin • Clientes</h1>
        <div className="flex items-center gap-2">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar por nome, e-mail, empresa…"
            className="border rounded-lg px-3 py-2 w-80"
          />
          <button onClick={() => setQ("")} className="px-3 py-2 border rounded-lg hover:bg-gray-50">
            Limpar
          </button>
        </div>
      </div>

      {errorMsg && (
        <div className="mt-4 p-3 rounded bg-amber-50 text-amber-800 text-sm">{errorMsg}</div>
      )}

      {loading ? (
        <div className="mt-6 text-sm text-gray-500">Carregando…</div>
      ) : (
        <div className="mt-6 grid gap-3">
          {filtered.map((c) => {
            const dLeft = daysLeft(c.end_date);
            const expired = c.active ? dLeft !== null && dLeft < 0 : true;
            const plan = planById[c.plan_id];
            const planLabel = plan ? `${plan.name} (${plan.id})` : c.plan_id || "—";

            return (
              <div
                key={c.id}
                className="border rounded-xl p-4 grid md:grid-cols-12 gap-3 items-center"
              >
                {/* Identificação */}
                <div className="md:col-span-3">
                  <div className="font-semibold">{c.name || c.company_name || "—"}</div>
                  <div className="text-sm text-gray-600">{c.email}</div>
                  <div className="text-xs text-gray-500">ID: <code>{c.id}</code></div>
                </div>

                {/* Plano */}
                <div className="md:col-span-3">
                  <label className="text-xs text-gray-500">Plano</label>
                  <select
                    value={c.plan_id || ""}
                    onChange={(e) => handleChange(c.id, "plan_id", e.target.value)}
                    className="w-full border rounded-lg px-2 py-2"
                  >
                    <option value="">— selecione —</option>
                    {plans.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.id})
                      </option>
                    ))}
                  </select>
                  <div className="text-xs text-gray-500 mt-1">
                    Atual: <span className="font-medium">{planLabel}</span>
                  </div>
                </div>

                {/* Datas */}
                <div className="md:col-span-2">
                  <label className="text-xs text-gray-500">Início</label>
                  <input
                    type="date"
                    value={c.start_date ? ymd(c.start_date) : ""}
                    onChange={(e) => handleChange(c.id, "start_date", e.target.value)}
                    className="w-full border rounded-lg px-2 py-2"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="text-xs text-gray-500">Fim</label>
                  <input
                    type="date"
                    value={c.end_date ? ymd(c.end_date) : ""}
                    onChange={(e) => handleChange(c.id, "end_date", e.target.value)}
                    className="w-full border rounded-lg px-2 py-2"
                  />
                  <div className="text-xs mt-1">
                    {dLeft === null ? (
                      <span className="text-gray-500">sem data de fim</span>
                    ) : expired ? (
                      <span className="text-red-600 font-medium">expirado</span>
                    ) : (
                      <span className="text-gray-600">restam {dLeft} dia(s)</span>
                    )}
                  </div>
                </div>

                {/* Status */}
                <div className="md:col-span-1">
                  <label className="text-xs text-gray-500 block">Status</label>
                  <button
                    onClick={() => handleChange(c.id, "active", !c.active)}
                    className={`w-full px-3 py-2 rounded-lg ${
                      c.active ? "bg-green-600 text-white" : "bg-gray-200 text-gray-800"
                    }`}
                  >
                    {c.active ? "Ativo" : "Inativo"}
                  </button>
                </div>

                {/* Ações primárias */}
                <div className="md:col-span-3 flex items-end gap-2">
                  <button
                    onClick={() => saveClient(c)}
                    disabled={savingId === c.id}
                    className="px-3 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60"
                  >
                    {savingId === c.id ? "Salvando…" : "Salvar"}
                  </button>
                  <button
                    onClick={() => applyPeriodFromPlan(c)}
                    className="px-3 py-2 rounded-lg border hover:bg-gray-50"
                  >
                    Aplicar período do plano
                  </button>
                </div>

                {/* Pagamento / verificação */}
                <div className="md:col-span-12 grid md:grid-cols-12 gap-2 border-t pt-3">
                  <div className="md:col-span-3 text-xs text-gray-600">
                    <div className="font-semibold">Pagamento (opcional)</div>
                    <div>
                      Para planos pagos, verifique o pagamento e aplique o período. (Planos FREE
                      não precisam verificação.)
                    </div>
                  </div>
                  <div className="md:col-span-3">
                    <input
                      value={c._session_id}
                      onChange={(e) => handleChange(c.id, "_session_id", e.target.value)}
                      placeholder="Stripe session_id"
                      className="w-full border rounded-lg px-2 py-2 text-sm"
                    />
                  </div>
                  <div className="md:col-span-3">
                    <input
                      value={c._payment_id}
                      onChange={(e) => handleChange(c.id, "_payment_id", e.target.value)}
                      placeholder="MP payment_id"
                      className="w-full border rounded-lg px-2 py-2 text-sm"
                    />
                  </div>
                  <div className="md:col-span-3">
                    <button
                      onClick={() => verifyAndApply(c)}
                      disabled={verifyingId === c.id}
                      className="w-full px-3 py-2 rounded-lg border hover:bg-gray-50 disabled:opacity-60"
                    >
                      {verifyingId === c.id ? "Verificando…" : "Verificar e aplicar período"}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}

          {!filtered.length && (
            <div className="text-sm text-gray-500">Nenhum cliente encontrado.</div>
          )}
        </div>
      )}
    </div>
  );
}
