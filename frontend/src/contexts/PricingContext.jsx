import inboxApi from "../api/inboxApi";
import React, { createContext, useCallback, useContext, useEffect, useState } from "react";

const PricingCtx = createContext({
  plans: [], loading: true, error: "", refresh: ()=>{}
});

const DEFAULT = {
  id: "",
  name: "",
  monthlyPrice: 0,
  currency: "BRL",
  is_published: false,
  sort_order: 9999,
  is_free: false,
  trial_days: 14,
  billing_period_months: 1,
  modules: {
    omnichannel: { enabled: true, chat_sessions: 200 },
    crm: { enabled: true, opportunities: 500 },
    marketing: { enabled: true, posts_per_month: 20 },
    approvals: { enabled: true },
    ai_credits: { enabled: true, credits: 10000 },
    governance: { enabled: true },
  },
};

function normalize(p){
  return {
    ...DEFAULT,
    ...p,
    modules: {
      ...DEFAULT.modules,
      ...(p?.modules || {}),
      omnichannel: { ...DEFAULT.modules.omnichannel, ...(p?.modules?.omnichannel || {}) },
      crm: { ...DEFAULT.modules.crm, ...(p?.modules?.crm || {}) },
      marketing: { ...DEFAULT.modules.marketing, ...(p?.modules?.marketing || {}) },
      approvals: { ...DEFAULT.modules.approvals, ...(p?.modules?.approvals || {}) },
      ai_credits: { ...DEFAULT.modules.ai_credits, ...(p?.modules?.ai_credits || {}) },
      governance: { ...DEFAULT.modules.governance, ...(p?.modules?.governance || {}) },
    },
  };
}

export function PricingProvider({ children }){
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const refresh = useCallback(async ()=>{
    setLoading(true);
    setError("");
    try {
      let res;
      try { res = await inboxApi.get("/public/plans"); }
      catch { res = await inboxApi.get("/admin/plans"); }
      const data = res?.data ?? {};
      const list =
        Array.isArray(data?.plans) ? data.plans :
        Array.isArray(data?.data)  ? data.data  :
        Array.isArray(data)        ? data       : [];
      const normalized = list.map(normalize).sort((a,b)=> (a.sort_order ?? 9999)-(b.sort_order ?? 9999));
      setPlans(normalized);
      localStorage.setItem("plans_cache", JSON.stringify({ ts: Date.now(), list: normalized }));
    } catch (e) {
      setError("Falha ao carregar planos.");
      const cache = localStorage.getItem("plans_cache");
      if (cache) {
        try { const { list } = JSON.parse(cache); if (Array.isArray(list) && list.length) setPlans(list); } catch {}
      }
    } finally { setLoading(false); }
  },[]);

  useEffect(()=>{
    const cache = localStorage.getItem("plans_cache");
    if (cache) {
      try {
        const { ts, list } = JSON.parse(cache);
        if (Array.isArray(list) && list.length) setPlans(list);
        if (Date.now() - (ts || 0) < 5*60*1000) setLoading(false);
      } catch {}
    }
    refresh();

    const upd = ()=> refresh();
    window.addEventListener("plans-updated", upd);
    window.addEventListener("trial-updated", upd);
    return ()=>{
      window.removeEventListener("plans-updated", upd);
      window.removeEventListener("trial-updated", upd);
    };
  }, [refresh]);

  return (
    <PricingCtx.Provider value={{ plans, loading, error, refresh }}>
      {children}
    </PricingCtx.Provider>
  );
}

export const usePricing = ()=> useContext(PricingCtx);



