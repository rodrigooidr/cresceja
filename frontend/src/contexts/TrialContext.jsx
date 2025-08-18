
import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import api from "../api/api";

const TrialContext = createContext({ trialDays: 14, loading: true, refresh: () => {} });

export function TrialProvider({ children }) {
  const [trialDays, setTrialDays] = useState(14);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/api/public/plans");
      const list = Array.isArray(data?.plans) ? data.plans : Array.isArray(data) ? data : [];
      const free =
        list.find((p) => p.id === "free") ||
        list.find((p) => p.is_free || p.name?.toLowerCase() === "free");
      const td = Number(free?.trial_days ?? free?.trialDays ?? 14);
      const valid = Number.isFinite(td) && td >= 0 ? td : 14;
      setTrialDays(valid);
      localStorage.setItem("trialDays", String(valid));
      localStorage.setItem("trialDays_ts", String(Date.now()));
    } catch {
      const cached = Number(localStorage.getItem("trialDays"));
      if (Number.isFinite(cached)) setTrialDays(cached);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // TTL simples de 5 minutos para evitar bater na API a cada navegação
    const ts = Number(localStorage.getItem("trialDays_ts") || 0);
    const age = Date.now() - ts;
    const cached = Number(localStorage.getItem("trialDays"));
    if (age < 5 * 60 * 1000 && Number.isFinite(cached)) {
      setTrialDays(cached);
      setLoading(false);
      // ainda assim fazemos refresh para garantir atualização
      refresh();
    } else {
      refresh();
    }

    // AdminPlans pode disparar este evento após salvar -> atualiza instantâneo
    const onAdminUpdate = () => refresh();
    window.addEventListener("trial-updated", onAdminUpdate);
    return () => window.removeEventListener("trial-updated", onAdminUpdate);
  }, [refresh]);

  return (
    <TrialContext.Provider value={{ trialDays, loading, refresh }}>
      {children}
    </TrialContext.Provider>
  );
}

export const useTrial = () => useContext(TrialContext);
