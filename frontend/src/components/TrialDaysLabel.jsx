// src/components/TrialDaysLabel.jsx
import React from "react";
import { useTrial } from "../contexts/TrialContext";

export default function TrialDaysLabel({ prefix = "—", suffix = "grátis" }) {
  const { trialDays } = useTrial();
  if (trialDays <= 0) return null; // se você zerar o trial, some automaticamente
  return (
    <>
      {prefix} {trialDays} dia{trialDays === 1 ? "" : "s"} {suffix}
    </>
  );
}
