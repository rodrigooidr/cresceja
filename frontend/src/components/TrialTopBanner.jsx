// src/components/TrialTopBanner.jsx
import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../api/api";
import TrialDaysLabel from "./TrialDaysLabel";

export default function TrialTopBanner() {
  const [dismissed, setDismissed] = useState(
    () => localStorage.getItem("hide_trial_banner") === "1"
  );
  const [status, setStatus] = useState(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const { data } = await api.get("/api/subscription/status");
        if (mounted) setStatus(data || null);
      } catch {
        // ok: se falhar, caímos no TrialDaysLabel
      }
    })();
    return () => (mounted = false);
  }, []);

  if (dismissed) return null;

  // tenta dias restantes do backend em formatos diferentes
  const days =
    typeof status?.daysRemaining === "number"
      ? status.daysRemaining
      : typeof status?.trial_days_left === "number"
      ? status.trial_days_left
      : null;

  // mostra só se for período de teste (plano free) e não expirado
  const isFree =
    status?.is_free === true ||
    status?.plan === "free" ||
    status?.plan_id === "free";
  const active = status?.active !== false && status?.status !== "expired";
  if (!isFree || !active) return null;

  return (
    <div className="w-full bg-indigo-600 text-white text-sm">
      <div className="max-w-7xl mx-auto px-4 py-2 flex items-center justify-between gap-3">
        <div>
          {typeof days === "number" ? (
            <>
              Seu <b>teste</b> termina em <b>{days}</b> dia{days === 1 ? "" : "s"}.
            </>
          ) : (
            <>
              Aproveite seu <TrialDaysLabel />.
            </>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Link
            to="/checkout?plan=pro"
            className="bg-white/10 hover:bg-white/20 px-3 py-1 rounded"
          >
            Assinar agora
          </Link>
          <button
            onClick={() => {
              localStorage.setItem("hide_trial_banner", "1");
              setDismissed(true);
            }}
            className="px-2 py-1 hover:bg-white/10 rounded"
            aria-label="Fechar banner de teste"
            title="Fechar"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
