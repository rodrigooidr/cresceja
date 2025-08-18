// src/index.js
import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// Providers (importe apenas os que você tem no projeto)
import { TrialProvider } from "./contexts/TrialContext";
import { PricingProvider } from "./contexts/PricingContext";   // se existir
import { AuthProvider } from "./contexts/AuthContext";         // se existir
import ErrorBoundary from "./components/ErrorBoundary";         // se criou

if (process.env.NODE_ENV !== "production") {
  try { require("./debug/installDebug"); } catch {}
}

const container = document.getElementById("root");
if (!container) throw new Error('Elemento <div id="root" /> não encontrado em public/index.html');

const root = createRoot(container);
root.render(
  <React.StrictMode>
    <ErrorBoundary>
      <AuthProvider>        {/* remova se não existir */}
        <TrialProvider>     {/* mantenha se usa Trial */}
          <PricingProvider> {/* remova se não existir */}
            <App />
          </PricingProvider>
        </TrialProvider>
      </AuthProvider>
    </ErrorBoundary>
  </React.StrictMode>
);
