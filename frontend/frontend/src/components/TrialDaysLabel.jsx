import React from "react";
import { useTrial } from "../contexts/TrialContext";

export default function TrialDaysLabel() {
  const { trialDays } = useTrial() || {};
  if (!trialDays) return null;
  return <span className="ml-1 text-xs opacity-80">({trialDays} dias grátis)</span>;
}
