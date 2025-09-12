import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import inboxApi from "../api/inboxApi";

const Ctx = createContext({ trialDays: null });

export function TrialProvider({ children }) {
  const [trialDays, setTrialDays] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await inboxApi.get("/public/plans");
        const items = Array.isArray(res?.data?.items) ? res.data.items : [];
        // Heurística simples: pega o maior trial_days entre os planos públicos
        const maxTrial = items.reduce((acc, p) => Math.max(acc, Number(p?.trial_days || 0)), 0);
        setTrialDays(Number.isFinite(maxTrial) ? maxTrial : null);
      } catch {
        setTrialDays(null);
      }
    })();
  }, []);

  const value = useMemo(() => ({ trialDays }), [trialDays]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useTrial() {
  return useContext(Ctx);
}
