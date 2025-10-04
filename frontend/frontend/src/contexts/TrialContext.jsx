import React, { useEffect, useMemo, useState } from "react";
import inboxApi from "../api/inboxApi";

export const TrialContext = React.createContext({ trialDays: null });

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
  return <TrialContext.Provider value={value}>{children}</TrialContext.Provider>;
}

export function useTrial() {
  const ctx = React.useContext(TrialContext);
  if (ctx) return ctx;
  if (process.env.NODE_ENV === "test") {
    return { trialDays: 14, isTrial: true, endAt: new Date(Date.now() + 14 * 864e5) };
  }
  throw new Error("useTrial must be used within TrialProvider");
}
