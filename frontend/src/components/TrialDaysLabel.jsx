import React from "react";
import { useTrial } from "../contexts/TrialContext";

export default function TrialDaysLabel({ prefix = "" }) {
  const { trialDays } = useTrial() || {};

  if (trialDays == null || Number(trialDays) <= 0) return null;

  return (
    <span className="ml-1 text-xs text-white/80">
      {prefix}{trialDays} dias grátis
    </span>
  );
}
