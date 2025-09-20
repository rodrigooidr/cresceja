// src/index.js
import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import inboxApi from "./api/inboxApi";

// Providers
import { TrialProvider } from "./contexts/TrialContext";
import { PricingProvider } from "./contexts/PricingContext";   // se existir
import { AuthProvider } from "./contexts/AuthContext";         // se existir
import { OrgProvider } from "./contexts/OrgContext";

if (typeof window !== "undefined") {
  window.inboxApi = window.inboxApi || inboxApi;
}

if (process.env.NODE_ENV !== "production") {
  try { require("./debug/installDebug"); } catch {}
}

const container = document.getElementById("root");
if (!container) throw new Error('Elemento <div id="root" /> não encontrado em public/index.html');

const root = createRoot(container);
root.render(
  <React.StrictMode>
    <AuthProvider>
      <OrgProvider>
        <TrialProvider>
          <PricingProvider>
            <App />
          </PricingProvider>
        </TrialProvider>
      </OrgProvider>
    </AuthProvider>
  </React.StrictMode>
);
